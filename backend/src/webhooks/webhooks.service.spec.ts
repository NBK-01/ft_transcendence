import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, FindOperator, Repository } from 'typeorm';
import {
  ShipmentState,
  TRACKING_TRANSITIONS,
} from '../shipments/constants/shipment-state';
import { ShipmentActorType } from '../shipments/constants/shipment-actor';
import { Shipment } from '../shipments/entities/shipment.entity';
import {
  InvalidShipmentStateException,
  ShipmentNotFoundException,
} from '../shipments/exceptions';
import { ShipmentsService } from '../shipments/shipments.service';
import {
  WebhookLogStatus,
  WebhookProvider,
} from './constants/webhook.constants';
import { WebhookLog } from './entities/webhook-log.entity';
import { InvalidWebhookPayloadException } from './exceptions';
import { WebhookSignals } from './webhook-signals';
import { CarrierEventTooEarlyError, WebhooksService } from './webhooks.service';

const event = (eventId = 'evt_1', extra: Record<string, unknown> = {}) => ({
  eventId,
  type: 'tracking.updated',
  data: {
    trackingId: 'trk-4a6f90',
    status: 'in_transit',
    location: 'Lyon hub',
  },
  ...extra,
});

type Row = Record<string, unknown>;

/** A find's `where`, on one row: equality, plus the In and MoreThan the service uses. */
const matches = (row: object, where: object) =>
  Object.entries(where).every(([key, expected]) => {
    const actual = (row as Row)[key];
    if (expected instanceof FindOperator) {
      if (expected.type === 'moreThan') {
        return actual instanceof Date && actual > (expected.value as Date);
      }
      return (expected.value as unknown[]).includes(actual);
    }
    return actual === expected;
  });

/** The webhook_log table, in memory: what the service's queries do to it. */
class FakeLogs {
  rows: WebhookLog[] = [];

  find = (where: object) => this.rows.find((row) => matches(row, where));

  repository = {
    createQueryBuilder: () => {
      let values: Partial<WebhookLog> = {};
      let set: Row = {};
      let id = '';
      let params: Row = {};
      const builder = {
        insert: () => builder,
        into: () => builder,
        values: (v: Partial<WebhookLog>) => ((values = v), builder),
        orIgnore: () => builder,
        returning: () => builder,
        update: () => builder,
        set: (s: Row) => ((set = s), builder),
        where: (_: string, p: { id: string }) => ((id = p.id), builder),
        andWhere: (_: string, p: Row) => ((params = p), builder),
        execute: () => {
          if (values.idempotencyKey !== undefined) {
            // INSERT … ON CONFLICT (idempotency_key) DO NOTHING RETURNING id
            if (
              this.rows.some(
                (row) => row.idempotencyKey === values.idempotencyKey,
              )
            ) {
              return Promise.resolve({ raw: [] });
            }
            const row = this.add(values);
            return Promise.resolve({ raw: [{ id: row.id }] });
          }
          const row = this.rows.find((r) => r.id === id);
          const affected = row && this.updatable(row, params) ? row : null;
          if (affected) {
            const { attempts, updatedAt, ...plain } = set;
            Object.assign(affected, plain);
            if (attempts) affected.attempts += 1;
            if (updatedAt) affected.updatedAt = new Date();
          }
          return Promise.resolve({ affected: affected ? 1 : 0 });
        },
      };
      return builder;
    },
    findOneByOrFail: (where: Partial<WebhookLog>) => {
      const row = this.find(where);
      return row
        ? Promise.resolve(row)
        : Promise.reject(new Error('not found'));
    },
    create: (values: Partial<WebhookLog>) => values,
    save: (values: Partial<WebhookLog>) => Promise.resolve(this.add(values)),
    update: (where: Partial<WebhookLog>, changes: Partial<WebhookLog>) => {
      const row = this.find(where);
      if (row) Object.assign(row, changes);
      return Promise.resolve({ affected: row ? 1 : 0 });
    },
  } as unknown as Repository<WebhookLog>;

  /**
   * The two conditional UPDATEs. The claim: WHERE status IN (from) OR
   * (PROCESSING AND (claimed_by = claimant OR updated_at < staleBefore)).
   * The last word: WHERE RECEIVED OR (PROCESSING AND claimed_by = claimant).
   */
  private updatable(row: WebhookLog, params: Row) {
    const heldBy = (claimant: unknown) =>
      row.status === WebhookLogStatus.PROCESSING && row.claimedBy === claimant;
    if ('staleBefore' in params) {
      return (
        (params.from as WebhookLogStatus[]).includes(row.status) ||
        heldBy(params.claimant) ||
        (row.status === WebhookLogStatus.PROCESSING &&
          row.updatedAt < (params.staleBefore as Date))
      );
    }
    return row.status === WebhookLogStatus.RECEIVED || heldBy(params.claimant);
  }

  add(values: Partial<WebhookLog>): WebhookLog {
    const row = {
      id: randomUUID(),
      provider: WebhookProvider.CARRIER,
      status: WebhookLogStatus.RECEIVED,
      attempts: 0,
      errorMessage: null,
      processedAt: null,
      idempotencyKey: null,
      duplicateOfId: null,
      claimedBy: null,
      occurredAt: null,
      updatedAt: new Date(),
      ...values,
    } as WebhookLog;
    this.rows.push(row);
    return row;
  }
}

function setup({
  status = ShipmentState.CONFIRMED,
}: { status?: ShipmentState } = {}) {
  const logs = new FakeLogs();
  let shipment: Shipment | null = {
    id: 'ship-1',
    trackingId: 'TRK-4A6F90',
    status,
  } as Shipment;
  const shipmentsService = {
    // Like the real one: the shipment moves.
    transition: jest.fn(
      (_m: unknown, target: Shipment, step: { to: ShipmentState }) => {
        target.status = step.to;
        return Promise.resolve();
      },
    ),
  };
  /** Runs at the start of each transaction, e.g. to have another job take the claim over meanwhile. */
  const hooks: { beforeTransaction?: () => void } = {};
  // The transaction's manager reads and writes the same fake table.
  const manager = {
    findOne: (entity: unknown, { where }: { where: object }) =>
      Promise.resolve(
        entity === Shipment
          ? shipment && matches(shipment, where)
            ? shipment
            : null
          : (logs.find(where) ?? null),
      ),
    exists: (_entity: unknown, { where }: { where: object }) =>
      Promise.resolve(logs.find(where) !== undefined),
    update: (_entity: unknown, id: string, changes: Partial<WebhookLog>) =>
      logs.repository.update({ id }, changes as never),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) => {
      hooks.beforeTransaction?.();
      return work(manager);
    }),
  } as unknown as DataSource;
  const events = { emitAsync: jest.fn().mockResolvedValue([]) };
  const service = new WebhooksService(
    logs.repository,
    shipmentsService as unknown as ShipmentsService,
    dataSource,
    events as unknown as EventEmitter2,
  );
  return {
    service,
    logs,
    shipmentsService,
    events,
    hooks,
    shipment: () => shipment,
    removeShipment: () => (shipment = null),
  };
}

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('WebhooksService.receiveCarrierEvent', () => {
  it('logs the first delivery and has it queued', async () => {
    const { service, logs, events } = setup();

    await expect(service.receiveCarrierEvent(event())).resolves.toEqual({
      received: true,
    });

    expect(logs.rows).toEqual([
      expect.objectContaining({
        provider: WebhookProvider.CARRIER,
        eventType: 'tracking.updated',
        resourceId: 'TRK-4A6F90',
        idempotencyKey: 'carrier:evt_1',
        status: WebhookLogStatus.RECEIVED,
      }),
    ]);
    const [first] = logs.rows;
    expect(events.emitAsync).toHaveBeenCalledWith(
      WebhookSignals.CARRIER_EVENT_RECEIVED,
      { webhookLogId: first!.id, deliveryId: first!.id },
    );
  });

  it('logs a redelivery as a DUPLICATE of the first, and doesn’t queue a processed event again', async () => {
    const { service, logs, events } = setup();
    await service.receiveCarrierEvent(event());
    logs.rows[0]!.status = WebhookLogStatus.PROCESSED;
    events.emitAsync.mockClear();

    await expect(service.receiveCarrierEvent(event())).resolves.toEqual({
      received: true,
      duplicate: true,
    });

    expect(logs.rows[1]).toMatchObject({
      status: WebhookLogStatus.DUPLICATE,
      duplicateOfId: logs.rows[0]!.id,
      idempotencyKey: null,
    });
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it.each([WebhookLogStatus.RECEIVED, WebhookLogStatus.FAILED])(
    'queues the event again when a redelivery finds it %s',
    async (status) => {
      const { service, logs, events } = setup();
      await service.receiveCarrierEvent(event());
      logs.rows[0]!.status = status;
      events.emitAsync.mockClear();

      await service.receiveCarrierEvent(event());

      expect(events.emitAsync).toHaveBeenCalledWith(
        WebhookSignals.CARRIER_EVENT_RECEIVED,
        { webhookLogId: logs.rows[0]!.id, deliveryId: logs.rows[1]!.id },
      );
    },
  );

  it('acknowledges an event type it doesn’t use, without logging it', async () => {
    const { service, logs, events } = setup();
    await expect(
      service.receiveCarrierEvent({ eventId: 'e', type: 'invoice.paid' }),
    ).resolves.toEqual({ received: true, ignored: true });
    expect(logs.rows).toEqual([]);
    expect(events.emitAsync).not.toHaveBeenCalled();
  });

  it('fails the request when the job can’t be queued, so the carrier redelivers', async () => {
    const { service, events } = setup();
    events.emitAsync.mockRejectedValue(new Error('Redis is down'));
    await expect(service.receiveCarrierEvent(event())).rejects.toThrow(
      'Redis is down',
    );
  });
});

describe('WebhooksService.receiveCarrierEvent: when it happened', () => {
  const at = (occurredAt: unknown) =>
    event('evt_1', {
      data: { ...event().data, occurredAt },
    });

  it('stores the carrier’s occurredAt, or when it arrived if the carrier didn’t say', async () => {
    const { service, logs } = setup();
    await service.receiveCarrierEvent(at('2026-10-27T09:30:00Z'));
    const before = Date.now();
    await service.receiveCarrierEvent(event('evt_2'));

    expect(logs.rows[0]!.occurredAt).toEqual(new Date('2026-10-27T09:30:00Z'));
    expect(logs.rows[1]!.occurredAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it.each([
    ['not a date', 'yesterday'],
    ['not a string', 1761557400],
    [
      'over 5 minutes ahead of our clock',
      new Date(Date.now() + 10 * 60_000).toISOString(),
    ],
  ])(
    'refuses an occurredAt that is %s (400, 6004), and logs nothing',
    async (_, value) => {
      const { service, logs } = setup();
      await expect(
        service.receiveCarrierEvent(at(value)),
      ).rejects.toBeInstanceOf(InvalidWebhookPayloadException);
      expect(logs.rows).toEqual([]);
    },
  );
});

const JOB = 'delivery-1';

async function logged(options?: Parameters<typeof setup>[0], body = event()) {
  const context = setup(options);
  await context.service.receiveCarrierEvent(body);
  return { ...context, id: context.logs.rows.at(-1)!.id };
}

describe('WebhooksService.processCarrierEvent: one job at a time', () => {
  it('applies the update through the shipment transition, then PROCESSED, and lets the claim go', async () => {
    const { service, logs, shipmentsService, id } = await logged();

    await expect(service.processCarrierEvent(id, JOB)).resolves.toBe(
      WebhookLogStatus.PROCESSED,
    );

    expect(shipmentsService.transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'ship-1' }),
      {
        from: TRACKING_TRANSITIONS[ShipmentState.IN_TRANSIT],
        to: ShipmentState.IN_TRANSIT,
        location: 'Lyon hub',
        actor: { type: ShipmentActorType.CARRIER, id: null },
      },
    );
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.PROCESSED,
      attempts: 1,
      claimedBy: null,
    });
    expect(logs.rows[0]!.processedAt).toBeInstanceOf(Date);
  });

  it('lets the job that holds the claim take it back at once (its retry, or a re-run after a crash)', async () => {
    const { service, logs, shipmentsService, id } = await logged();
    // The job claimed it, then died before letting it go.
    Object.assign(logs.rows[0]!, {
      status: WebhookLogStatus.PROCESSING,
      claimedBy: JOB,
      updatedAt: new Date(),
    });

    await expect(
      service.processCarrierEvent(id, 'delivery-2'),
    ).resolves.toBeNull();
    expect(shipmentsService.transition).not.toHaveBeenCalled();

    await expect(service.processCarrierEvent(id, JOB)).resolves.toBe(
      WebhookLogStatus.PROCESSED,
    );
    expect(logs.rows[0]!.attempts).toBe(2);
  });

  it('lets another job take over a claim held for over 5 minutes (that job died for good)', async () => {
    const { service, logs, id } = await logged();
    Object.assign(logs.rows[0]!, {
      status: WebhookLogStatus.PROCESSING,
      claimedBy: JOB,
      updatedAt: new Date(Date.now() - 6 * 60_000),
    });

    await expect(service.processCarrierEvent(id, 'delivery-2')).resolves.toBe(
      WebhookLogStatus.PROCESSED,
    );
  });

  it('stops without applying when another job took the claim over meanwhile', async () => {
    const { service, logs, shipmentsService, hooks, id } = await logged();
    hooks.beforeTransaction = () => {
      logs.rows[0]!.claimedBy = 'delivery-2';
    };

    await expect(service.processCarrierEvent(id, JOB)).resolves.toBeNull();
    expect(shipmentsService.transition).not.toHaveBeenCalled();
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.PROCESSING,
      claimedBy: 'delivery-2',
    });
  });

  it('does nothing for an event already processed', async () => {
    const { service, logs, shipmentsService, id } = await logged();
    logs.rows[0]!.status = WebhookLogStatus.PROCESSED;

    await expect(service.processCarrierEvent(id, JOB)).resolves.toBeNull();
    expect(shipmentsService.transition).not.toHaveBeenCalled();
  });
});

describe('WebhooksService.processCarrierEvent: what happens to the event', () => {
  it('marks an unknown tracking ID FAILED at once, without a retry', async () => {
    const { service, logs, removeShipment, id } = await logged();
    removeShipment();

    await expect(service.processCarrierEvent(id, JOB)).resolves.toBe(
      WebhookLogStatus.FAILED,
    );
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.FAILED,
      claimedBy: null,
      errorMessage: new ShipmentNotFoundException('TRK-4A6F90').message,
    });
  });

  it.each([ShipmentState.DELIVERED, ShipmentState.CANCELLED])(
    'marks an event for a %s shipment FAILED at once: nothing can make it fit',
    async (status) => {
      const { service, logs, shipmentsService, id } = await logged({ status });

      await expect(service.processCarrierEvent(id, JOB)).resolves.toBe(
        WebhookLogStatus.FAILED,
      );
      expect(shipmentsService.transition).not.toHaveBeenCalled();
      expect(logs.rows[0]).toMatchObject({
        status: WebhookLogStatus.FAILED,
        errorMessage: new InvalidShipmentStateException(status).message,
      });
    },
  );

  it('retries an event that came too early (delivered while still in transit), and applies it once the step before it has', async () => {
    const delivered = event('evt_3', {
      data: { ...event().data, status: 'delivered', location: 'Paris 11e' },
    });
    const { service, logs, shipment, id } = await logged(
      { status: ShipmentState.IN_TRANSIT },
      delivered,
    );

    await expect(service.processCarrierEvent(id, JOB)).rejects.toBeInstanceOf(
      CarrierEventTooEarlyError,
    );
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.RECEIVED,
      claimedBy: null,
    });
    expect(logs.rows[0]!.errorMessage).toContain(
      'waiting for an earlier event',
    );

    // out_for_delivery arrives and is applied; BullMQ's retry then goes through.
    shipment()!.status = ShipmentState.OUT_FOR_DELIVERY;
    await expect(service.processCarrierEvent(id, JOB)).resolves.toBe(
      WebhookLogStatus.PROCESSED,
    );
    expect(shipment()!.status).toBe(ShipmentState.DELIVERED);
  });

  it('puts anything else back to RECEIVED and rethrows, so BullMQ retries it', async () => {
    const { service, logs, shipmentsService, id } = await logged();
    shipmentsService.transition.mockRejectedValueOnce(
      new Error('connection reset'),
    );

    await expect(service.processCarrierEvent(id, JOB)).rejects.toThrow(
      'connection reset',
    );
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.RECEIVED,
      claimedBy: null,
      errorMessage: 'connection reset',
    });
  });
});

describe('WebhooksService.processCarrierEvent: a shipment’s events in the order they happened', () => {
  it('skips an event older than one already applied to the same shipment (SUPERSEDED), so the shipment doesn’t go back', async () => {
    const { service, logs, shipmentsService } = setup({
      status: ShipmentState.IN_TRANSIT,
    });
    const step = (eventId: string, status: string, occurredAt: string) =>
      service.receiveCarrierEvent(
        event(eventId, {
          data: { ...event().data, status, occurredAt },
        }),
      );
    await step('evt_lyon', 'in_transit', '2026-10-27T08:00:00Z');
    await step('evt_out', 'out_for_delivery', '2026-10-27T09:00:00Z');
    const [lyon, out] = logs.rows;

    // The later one is processed first.
    await expect(service.processCarrierEvent(out!.id, 'd-out')).resolves.toBe(
      WebhookLogStatus.PROCESSED,
    );
    await expect(service.processCarrierEvent(lyon!.id, 'd-lyon')).resolves.toBe(
      WebhookLogStatus.SUPERSEDED,
    );

    expect(shipmentsService.transition).toHaveBeenCalledTimes(1);
    expect(lyon).toMatchObject({
      status: WebhookLogStatus.SUPERSEDED,
      claimedBy: null,
    });
  });

  it('still applies an event that happened after (or at the same time as) the last one applied', async () => {
    const { service, logs } = setup({ status: ShipmentState.IN_TRANSIT });
    const step = (eventId: string, location: string, occurredAt: string) =>
      service.receiveCarrierEvent(
        event(eventId, {
          data: { ...event().data, location, occurredAt },
        }),
      );
    await step('evt_a', 'Lyon hub', '2026-10-27T08:00:00Z');
    await step('evt_b', 'Paris hub', '2026-10-27T08:00:00Z');
    await step('evt_c', 'Paris 11e', '2026-10-27T10:00:00Z');

    for (const [index, row] of logs.rows.entries()) {
      await expect(
        service.processCarrierEvent(row.id, `d-${index}`),
      ).resolves.toBe(WebhookLogStatus.PROCESSED);
    }
  });
});

describe('WebhooksService.markCarrierEventFailed', () => {
  it('fails an event waiting for a retry, or held by this job', async () => {
    const { service, logs } = setup();
    await service.receiveCarrierEvent(event('evt_1'));
    await service.receiveCarrierEvent(event('evt_2'));
    const [waiting, held] = logs.rows;
    Object.assign(held!, {
      status: WebhookLogStatus.PROCESSING,
      claimedBy: 'delivery-1',
    });

    await service.markCarrierEventFailed(waiting!.id, 'delivery-1');
    await service.markCarrierEventFailed(held!.id, 'delivery-1');

    expect(waiting!.status).toBe(WebhookLogStatus.FAILED);
    expect(held).toMatchObject({
      status: WebhookLogStatus.FAILED,
      claimedBy: null,
    });
  });

  it('leaves an event another job has taken over, or one that’s done', async () => {
    const { service, logs } = setup();
    await service.receiveCarrierEvent(event('evt_1'));
    await service.receiveCarrierEvent(event('evt_2'));
    const [takenOver, done] = logs.rows;
    Object.assign(takenOver!, {
      status: WebhookLogStatus.PROCESSING,
      claimedBy: 'delivery-2',
    });
    done!.status = WebhookLogStatus.PROCESSED;

    await service.markCarrierEventFailed(takenOver!.id, 'delivery-1');
    await service.markCarrierEventFailed(done!.id, 'delivery-1');

    expect(takenOver!.status).toBe(WebhookLogStatus.PROCESSING);
    expect(done!.status).toBe(WebhookLogStatus.PROCESSED);
  });
});
