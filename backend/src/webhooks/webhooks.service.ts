import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TRACKING_TRANSITIONS } from '../shipments/constants/shipment-state';
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
  parseCarrierEnvelope,
  parseTrackingUpdate,
} from './dto/carrier-event';
import { CarrierEventReceivedSignal, WebhookSignals } from './webhook-signals';

export interface WebhookReceipt {
  received: true;
  /** A redelivery of an event we already had. */
  duplicate?: true;
  /** An event type we don't act on. */
  ignored?: true;
}

/** A processing failure no retry can fix: the event is marked FAILED, not retried. */
const isPermanent = (error: unknown) =>
  error instanceof ShipmentNotFoundException ||
  error instanceof InvalidShipmentStateException;

/**
 * Carrier webhooks: log every delivery, process each event once.
 *
 * receive() runs in the request: it stores the delivery and has it queued,
 * then answers fast. process() runs in the queue's job: it applies the
 * tracking update through ShipmentsService.transition, the same path as an
 * admin's or a partner's, so the allowed moves and the customer's
 * notification are the same.
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
    // Still RECEIVED: its job may have been lost (a crash after the insert). FAILED: worth another go.
    if (
      original.status === WebhookLogStatus.RECEIVED ||
      original.status === WebhookLogStatus.FAILED
    ) {
      await this.signal({
        webhookLogId: original.id,
        deliveryId: duplicate.id,
      });
    }
    return { received: true, duplicate: true };
  }

  /**
   * The job's work. Claims the event (RECEIVED or FAILED → PROCESSING), so
   * two jobs for one event never both apply it. A failure no retry can fix
   * (unknown tracking ID, a move not allowed from where the shipment is) is
   * FAILED at once; anything else goes back to RECEIVED and is rethrown, so
   * BullMQ retries it.
   */
  async processCarrierEvent(
    webhookLogId: string,
  ): Promise<WebhookLogStatus | null> {
    const claimed = await this.webhookLogRepository
      .createQueryBuilder()
      .update(WebhookLog)
      .set({
        status: WebhookLogStatus.PROCESSING,
        attempts: () => 'attempts + 1',
      })
      .where('id = :id', { id: webhookLogId })
      .andWhere('status IN (:...from)', {
        from: [WebhookLogStatus.RECEIVED, WebhookLogStatus.FAILED],
      })
      .execute();
    if (!claimed.affected) {
      // Already processed, or another job has it.
      return null;
    }
    const log = await this.webhookLogRepository.findOneByOrFail({
      id: webhookLogId,
    });

    try {
      const update = parseTrackingUpdate(
        parseCarrierEnvelope(log.payload).data,
      );
      const shipment = await this.shipmentsService.findOne(update.trackingId);
      await this.dataSource.transaction((manager) =>
        this.shipmentsService.transition(manager, shipment, {
          from: TRACKING_TRANSITIONS[update.status] ?? [],
          to: update.status,
          location: update.location,
        }),
      );
      await this.setStatus(webhookLogId, WebhookLogStatus.PROCESSED, {
        processedAt: new Date(),
        errorMessage: null,
      });
      return WebhookLogStatus.PROCESSED;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPermanent(error)) {
        await this.setStatus(webhookLogId, WebhookLogStatus.FAILED, {
          errorMessage: message,
        });
        this.logger.warn(`Carrier event ${webhookLogId} failed: ${message}`);
        return WebhookLogStatus.FAILED;
      }
      await this.setStatus(webhookLogId, WebhookLogStatus.RECEIVED, {
        errorMessage: message,
      });
      throw error;
    }
  }

  /** The job ran out of attempts: whatever it was doing, the event is FAILED. */
  async markCarrierEventFailed(webhookLogId: string): Promise<void> {
    await this.webhookLogRepository.update(
      {
        id: webhookLogId,
        status: In([WebhookLogStatus.RECEIVED, WebhookLogStatus.PROCESSING]),
      },
      { status: WebhookLogStatus.FAILED },
    );
  }

  /** The first delivery's row id, or null when the event was already logged (ON CONFLICT DO NOTHING). */
  private async insertFirstDelivery(
    envelope: CarrierEnvelope,
    values: Pick<
      WebhookLog,
      'provider' | 'eventType' | 'resourceId' | 'payload'
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

  private async setStatus(
    id: string,
    status: WebhookLogStatus,
    changes: Partial<Pick<WebhookLog, 'processedAt' | 'errorMessage'>> = {},
  ): Promise<void> {
    await this.webhookLogRepository.update(id, { status, ...changes });
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
