import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, MoreThan, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { CARRIER_ACTOR } from '../shipments/constants/shipment-actor';
import {
  ShipmentState,
  TRACKING_TRANSITIONS,
} from '../shipments/constants/shipment-state';
import { Shipment } from '../shipments/entities/shipment.entity';
import {
  InvalidShipmentStateException,
  ShipmentNotFoundException,
} from '../shipments/exceptions';
import { ShipmentsService } from '../shipments/shipments.service';
import {
  CARRIER_TRACKING_UPDATED,
  WebhookLogStatus,
  WebhookProvider,
} from './constants/webhook.constants';
import { WebhookLog } from './entities/webhook-log.entity';
import {
  CarrierEnvelope,
  CarrierTrackingUpdate,
  parseCarrierEnvelope,
  parseTrackingUpdate,
} from './dto/carrier-event';
import { InvalidWebhookPayloadException } from './exceptions';
import { CarrierEventReceivedSignal, WebhookSignals } from './webhook-signals';

export interface WebhookReceipt {
  received: true;
  /** A redelivery of an event we already had. */
  duplicate?: true;
  /** An event type we don't act on. */
  ignored?: true;
}

/**
 * A PROCESSING claim older than this is a job that died for good: another
 * job may take the event over. The job that holds it can take it back at
 * any time (its retry, or BullMQ re-running it after a crash).
 */
const STALE_CLAIM_MS = 5 * 60_000;

/** No carrier move goes on from these, so an event that doesn't fit never will. */
const FINAL_STATES: readonly ShipmentState[] = [
  ShipmentState.DELIVERED,
  ShipmentState.CANCELLED,
];

/**
 * The shipment isn't where this event moves it from, but it may get there:
 * an earlier event is likely still on its way (events can arrive, or be
 * processed, out of order). Retried, so the earlier one can go first.
 */
export class CarrierEventTooEarlyError extends Error {
  constructor(to: ShipmentState, current: ShipmentState) {
    super(
      `Can't move to ${to} from ${current} yet: waiting for an earlier event`,
    );
  }
}

/** An event a job may (re)process: not done, not failed for good, and not held by a live job. */
const isClaimable = (log: Pick<WebhookLog, 'status' | 'updatedAt'>) =>
  log.status === WebhookLogStatus.RECEIVED ||
  log.status === WebhookLogStatus.FAILED ||
  (log.status === WebhookLogStatus.PROCESSING &&
    log.updatedAt.getTime() < Date.now() - STALE_CLAIM_MS);

/** A processing failure no retry can fix: the event is marked FAILED, not retried. */
const isPermanent = (error: unknown) =>
  error instanceof ShipmentNotFoundException ||
  error instanceof InvalidShipmentStateException ||
  error instanceof InvalidWebhookPayloadException;

/**
 * Carrier webhooks: log every delivery, process each event once.
 *
 * receive() runs in the request: it stores the delivery and has it queued,
 * then answers fast. process() runs in the queue's job: it applies the
 * tracking update through ShipmentsService.transition, the same path as an
 * admin's or a partner's, so the allowed moves and the customer's
 * notification are the same.
 *
 * A shipment's events apply in the order they happened (occurredAt), even
 * when they arrive or are processed out of order: one that comes too early
 * waits (retried) for the move before it, and one older than an event
 * already applied is skipped (SUPERSEDED).
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
    private readonly shipmentsService: ShipmentsService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Called after the signature guard. Throws 400 (6003) on a body we can't read. */
  async receiveCarrierEvent(body: unknown): Promise<WebhookReceipt> {
    const envelope = parseCarrierEnvelope(body);
    if (envelope.type !== CARRIER_TRACKING_UPDATED) {
      // Acknowledged, so the carrier doesn't keep redelivering what we'll never use.
      return { received: true, ignored: true };
    }
    const update = parseTrackingUpdate(envelope.data);
    const values = {
      provider: WebhookProvider.CARRIER,
      eventType: envelope.type,
      resourceId: update.trackingId,
      payload: body as Record<string, unknown>,
      occurredAt: update.occurredAt ?? new Date(),
    };

    const first = await this.insertFirstDelivery(envelope, values);
    if (first) {
      await this.signal({ webhookLogId: first, deliveryId: first });
      return { received: true };
    }

    // Seen before: log this delivery as a duplicate of the first.
    const original = await this.webhookLogRepository.findOneByOrFail({
      idempotencyKey: idempotencyKeyOf(envelope),
    });
    const duplicate = await this.webhookLogRepository.save(
      this.webhookLogRepository.create({
        ...values,
        idempotencyKey: null,
        duplicateOfId: original.id,
        status: WebhookLogStatus.DUPLICATE,
      }),
    );
    // Still RECEIVED: its job may have been lost (a crash after the insert).
    // FAILED: worth another go. A stale PROCESSING: its worker died.
    if (isClaimable(original)) {
      await this.signal({
        webhookLogId: original.id,
        deliveryId: duplicate.id,
      });
    }
    return { received: true, duplicate: true };
  }

  /**
   * The job's work; `claimant` is the job's id. Claims the event (RECEIVED,
   * FAILED, PROCESSING held by this same job, or a stale PROCESSING), so two
   * live jobs never both apply it, then applies it (see apply). A failure
   * no retry can fix (an unknown tracking ID, a shipment delivered or
   * cancelled) is FAILED at once; anything else, an event that came too
   * early included, goes back to RECEIVED and is rethrown, so BullMQ
   * retries it.
   */
  async processCarrierEvent(
    webhookLogId: string,
    claimant: string,
  ): Promise<WebhookLogStatus | null> {
    if (!(await this.claim(webhookLogId, claimant))) {
      // Already done, or another live job has it.
      return null;
    }
    try {
      const log = await this.webhookLogRepository.findOneByOrFail({
        id: webhookLogId,
      });
      const update = parseTrackingUpdate(
        parseCarrierEnvelope(log.payload).data,
      );
      return await this.dataSource.transaction((manager) =>
        this.apply(manager, log, update, claimant),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPermanent(error)) {
        await this.release(webhookLogId, claimant, WebhookLogStatus.FAILED, {
          errorMessage: message,
        });
        this.logger.warn(`Carrier event ${webhookLogId} failed: ${message}`);
        return WebhookLogStatus.FAILED;
      }
      await this.release(webhookLogId, claimant, WebhookLogStatus.RECEIVED, {
        errorMessage: message,
      });
      throw error;
    }
  }

  /** The job ran out of attempts: the event is FAILED, unless another job has taken it over since. */
  async markCarrierEventFailed(
    webhookLogId: string,
    claimant: string,
  ): Promise<void> {
    await this.webhookLogRepository
      .createQueryBuilder()
      .update(WebhookLog)
      .set({ status: WebhookLogStatus.FAILED, claimedBy: null })
      .where('id = :id', { id: webhookLogId })
      .andWhere(
        '(status = :received OR (status = :processing AND claimed_by = :claimant))',
        {
          received: WebhookLogStatus.RECEIVED,
          processing: WebhookLogStatus.PROCESSING,
          claimant,
        },
      )
      .execute();
  }

  /** RECEIVED, FAILED, PROCESSING held by this job, or a stale PROCESSING → PROCESSING, held by this job. */
  private async claim(webhookLogId: string, claimant: string) {
    const claimed = await this.webhookLogRepository
      .createQueryBuilder()
      .update(WebhookLog)
      .set({
        status: WebhookLogStatus.PROCESSING,
        claimedBy: claimant,
        attempts: () => 'attempts + 1',
        // Stamped explicitly: it's what dates the claim (see STALE_CLAIM_MS).
        updatedAt: () => 'now()',
      })
      .where('id = :id', { id: webhookLogId })
      .andWhere(
        '(status IN (:...from) OR (status = :processing AND (claimed_by = :claimant OR updated_at < :staleBefore)))',
        {
          from: [WebhookLogStatus.RECEIVED, WebhookLogStatus.FAILED],
          processing: WebhookLogStatus.PROCESSING,
          claimant,
          staleBefore: new Date(Date.now() - STALE_CLAIM_MS),
        },
      )
      .execute();
    return Boolean(claimed.affected);
  }

  /**
   * In one transaction, with the event's row and then the shipment's row
   * locked (always in that order): a job that lost its claim meanwhile
   * stops, and a shipment's events apply one at a time. An event older than
   * one already applied is SUPERSEDED; one the shipment isn't ready for is
   * too early (retried), unless the shipment is delivered or cancelled. The
   * move and the event's new status commit together, so a failure in
   * between can't leave it applied but not marked.
   */
  private async apply(
    manager: EntityManager,
    log: WebhookLog,
    update: CarrierTrackingUpdate,
    claimant: string,
  ): Promise<WebhookLogStatus | null> {
    const held = await manager.findOne(WebhookLog, {
      where: {
        id: log.id,
        status: WebhookLogStatus.PROCESSING,
        claimedBy: claimant,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!held) {
      // A stale claim another job took over: it's theirs now.
      return null;
    }
    const shipment = await manager.findOne(Shipment, {
      where: { trackingId: update.trackingId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!shipment) {
      throw new ShipmentNotFoundException(update.trackingId);
    }

    if (await this.laterEventApplied(manager, log)) {
      await this.finish(manager, log.id, WebhookLogStatus.SUPERSEDED);
      return WebhookLogStatus.SUPERSEDED;
    }
    const from = TRACKING_TRANSITIONS[update.status] ?? [];
    if (!from.includes(shipment.status)) {
      throw FINAL_STATES.includes(shipment.status)
        ? new InvalidShipmentStateException(shipment.status)
        : new CarrierEventTooEarlyError(update.status, shipment.status);
    }
    await this.shipmentsService.transition(manager, shipment, {
      from,
      to: update.status,
      location: update.location,
      actor: CARRIER_ACTOR,
    });
    await this.finish(manager, log.id, WebhookLogStatus.PROCESSED);
    return WebhookLogStatus.PROCESSED;
  }

  /** Whether an event for the same shipment that happened after this one was already applied. */
  private laterEventApplied(
    manager: EntityManager,
    log: WebhookLog,
  ): Promise<boolean> {
    if (!log.occurredAt || !log.resourceId) {
      return Promise.resolve(false);
    }
    return manager.exists(WebhookLog, {
      where: {
        provider: log.provider,
        resourceId: log.resourceId,
        status: WebhookLogStatus.PROCESSED,
        occurredAt: MoreThan(log.occurredAt),
      },
    });
  }

  /** Done (PROCESSED or SUPERSEDED), in the transaction: the claim is let go. */
  private async finish(
    manager: EntityManager,
    id: string,
    status: WebhookLogStatus,
  ): Promise<void> {
    await manager.update(WebhookLog, id, {
      status,
      processedAt: new Date(),
      errorMessage: null,
      claimedBy: null,
    });
  }

  /** The first delivery's row id, or null when the event was already logged (ON CONFLICT DO NOTHING). */
  private async insertFirstDelivery(
    envelope: CarrierEnvelope,
    values: Pick<
      WebhookLog,
      'provider' | 'eventType' | 'resourceId' | 'payload' | 'occurredAt'
    >,
  ): Promise<string | null> {
    const result = await this.webhookLogRepository
      .createQueryBuilder()
      .insert()
      .into(WebhookLog)
      // The jsonb payload doesn't fit TypeORM's insert type; it's a plain object.
      .values({
        ...values,
        idempotencyKey: idempotencyKeyOf(envelope),
        status: WebhookLogStatus.RECEIVED,
      } as QueryDeepPartialEntity<WebhookLog>)
      .orIgnore()
      .returning(['id'])
      .execute();
    const [row] = result.raw as Array<{ id: string }>;
    return row?.id ?? null;
  }

  /** Lets the claim go (FAILED for good, or RECEIVED for a retry), if this job still holds it. */
  private async release(
    id: string,
    claimant: string,
    status: WebhookLogStatus.FAILED | WebhookLogStatus.RECEIVED,
    changes: Partial<Pick<WebhookLog, 'errorMessage'>> = {},
  ): Promise<void> {
    await this.webhookLogRepository.update(
      { id, status: WebhookLogStatus.PROCESSING, claimedBy: claimant },
      { status, claimedBy: null, ...changes },
    );
  }

  /** Awaited: if the job can't be queued, the request fails and the carrier redelivers. */
  private async signal(signal: CarrierEventReceivedSignal): Promise<void> {
    await this.eventEmitter.emitAsync(
      WebhookSignals.CARRIER_EVENT_RECEIVED,
      signal,
    );
  }
}

/** The same on every redelivery of one event, and different for every provider. */
function idempotencyKeyOf(envelope: CarrierEnvelope): string {
  return `${WebhookProvider.CARRIER}:${envelope.eventId}`;
}
