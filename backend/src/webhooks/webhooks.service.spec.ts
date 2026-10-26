import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, FindOperator, Repository } from 'typeorm';
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
  WebhookLogStatus,
  WebhookProvider,
} from './constants/webhook.constants';
import { WebhookLog } from './entities/webhook-log.entity';
import { WebhookSignals } from './webhook-signals';
import { WebhooksService } from './webhooks.service';

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

/** The webhook_log table, in memory: what the service's queries do to it. */
class FakeLogs {
  rows: WebhookLog[] = [];

  find = (where: Partial<WebhookLog>) =>
    this.rows.find((row) =>
      Object.entries(where).every(
        ([key, value]) =>
          (row as unknown as Record<string, unknown>)[key] === value,
      ),
    );

  repository = {
    createQueryBuilder: () => {
      let values: Partial<WebhookLog> = {};
      let set: Record<string, unknown> = {};
      let id = '';
      let claimable: {
        from: WebhookLogStatus[];
        processing: WebhookLogStatus;
        staleBefore: Date;
      } | null = null;
      const builder = {
        insert: () => builder,
        into: () => builder,
        values: (v: Partial<WebhookLog>) => ((values = v), builder),
        orIgnore: () => builder,
        returning: () => builder,
        update: () => builder,
        set: (s: Record<string, unknown>) => ((set = s), builder),
        where: (_: string, params: { id: string }) => (
          (id = params.id),
          builder
        ),
        andWhere: (_: string, params: NonNullable<typeof claimable>) => (
          (claimable = params),
          builder
        ),
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
          // UPDATE … SET PROCESSING, attempts + 1, updated_at = now()
          // WHERE id AND (status IN (from) OR (PROCESSING AND updated_at < staleBefore))
          const row = this.rows.find(
            (r) =>
              r.id === id &&
              claimable !== null &&
              (claimable.from.includes(r.status) ||
                (r.status === claimable.processing &&
                  r.updatedAt < claimable.staleBefore)),
          );
          if (row) {
            row.status = set.status as WebhookLogStatus;
            row.attempts += 1;
            row.updatedAt = new Date();
          }
          return Promise.resolve({ affected: row ? 1 : 0 });
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
    update: (
      where: string | { id: string; status: FindOperator<WebhookLogStatus[]> },
      changes: Partial<WebhookLog>,
    ) => {
      const id = typeof where === 'string' ? where : where.id;
      const allowed =
        typeof where === 'string'
          ? null
          : (where.status.value as WebhookLogStatus[]);
      const row = this.rows.find(
        (r) => r.id === id && (!allowed || allowed.includes(r.status)),
      );
      if (row) Object.assign(row, changes);
      return Promise.resolve({ affected: row ? 1 : 0 });
    },
  } as unknown as Repository<WebhookLog>;

  /** manager.update(WebhookLog, id, changes), inside the processing transaction. */
  change(id: string, changes: Partial<WebhookLog>) {
    const row = this.rows.find((r) => r.id === id);
    if (row) Object.assign(row, changes);
    return { affected: row ? 1 : 0 };
  }

  add(values: Partial<WebhookLog>): WebhookLog {
    const row = {
      id: randomUUID(),
      status: WebhookLogStatus.RECEIVED,
      attempts: 0,
      errorMessage: null,
      processedAt: null,
      idempotencyKey: null,
      duplicateOfId: null,
      updatedAt: new Date(),
      ...values,
    } as WebhookLog;
    this.rows.push(row);
    return row;
  }
}

function setup({ findOne }: { findOne?: jest.Mock } = {}) {
  const logs = new FakeLogs();
  const shipment = {
    id: 'ship-1',
    trackingId: 'TRK-4A6F90',
    status: ShipmentState.CONFIRMED,
  } as Shipment;
  const shipmentsService = {
    findOne: findOne ?? jest.fn().mockResolvedValue(shipment),
    transition: jest.fn().mockResolvedValue(undefined),
  };
  // The transaction's manager writes to the same fake table (the PROCESSED mark).
  const manager = {
    update: (_entity: unknown, id: string, changes: Partial<WebhookLog>) =>
      Promise.resolve(logs.change(id, changes)),
  };
  const dataSource = {
    transaction: jest.fn((work: (m: typeof manager) => Promise<unknown>) =>
      work(manager),
    ),
  } as unknown as DataSource;
  const events = { emitAsync: jest.fn().mockResolvedValue([]) };
  const service = new WebhooksService(
    logs.repository,
    shipmentsService as unknown as ShipmentsService,
    dataSource,
    events as unknown as EventEmitter2,
  );
  return { service, logs, shipmentsService, events };
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

describe('WebhooksService.processCarrierEvent', () => {
  async function logged(options?: Parameters<typeof setup>[0]) {
    const context = setup(options);
    await context.service.receiveCarrierEvent(event());
    return { ...context, id: context.logs.rows[0]!.id };
  }

  it('applies the update through the shipment transition, then PROCESSED', async () => {
    const { service, logs, shipmentsService, id } = await logged();

    await expect(service.processCarrierEvent(id)).resolves.toBe(
      WebhookLogStatus.PROCESSED,
    );

    expect(shipmentsService.findOne).toHaveBeenCalledWith('TRK-4A6F90');
    expect(shipmentsService.transition).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'ship-1' }),
      {
        from: TRACKING_TRANSITIONS[ShipmentState.IN_TRANSIT],
        to: ShipmentState.IN_TRANSIT,
        location: 'Lyon hub',
      },
    );
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.PROCESSED,
      attempts: 1,
    });
    expect(logs.rows[0]!.processedAt).toBeInstanceOf(Date);
  });

  it('takes over an event stuck in PROCESSING for over 5 minutes (its worker died), not a fresh one', async () => {
    const { service, logs, shipmentsService, id } = await logged();
    const row = logs.rows[0]!;
    row.status = WebhookLogStatus.PROCESSING;
    row.updatedAt = new Date();

    await expect(service.processCarrierEvent(id)).resolves.toBeNull();
    expect(shipmentsService.transition).not.toHaveBeenCalled();

    row.updatedAt = new Date(Date.now() - 6 * 60_000);
    await expect(service.processCarrierEvent(id)).resolves.toBe(
      WebhookLogStatus.PROCESSED,
    );
  });

  it('does nothing for an event already processed (or being processed)', async () => {
    const { service, logs, shipmentsService, id } = await logged();
    logs.rows[0]!.status = WebhookLogStatus.PROCESSED;

    await expect(service.processCarrierEvent(id)).resolves.toBeNull();
    expect(shipmentsService.transition).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown tracking ID', new ShipmentNotFoundException('TRK-4A6F90')],
    [
      'a move not allowed from where the shipment is',
      new InvalidShipmentStateException(ShipmentState.DELIVERED),
    ],
  ])('marks %s FAILED at once, without a retry', async (_, error) => {
    const { service, logs, id } = await logged({
      findOne: jest.fn().mockRejectedValue(error),
    });

    await expect(service.processCarrierEvent(id)).resolves.toBe(
      WebhookLogStatus.FAILED,
    );
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.FAILED,
      errorMessage: error.message,
    });
  });

  it('puts anything else back to RECEIVED and rethrows, so BullMQ retries it', async () => {
    const { service, logs, id } = await logged({
      findOne: jest.fn().mockRejectedValue(new Error('connection reset')),
    });

    await expect(service.processCarrierEvent(id)).rejects.toThrow(
      'connection reset',
    );
    expect(logs.rows[0]).toMatchObject({
      status: WebhookLogStatus.RECEIVED,
      errorMessage: 'connection reset',
    });
  });

  it('after the last attempt, the event is FAILED', async () => {
    const { service, logs, id } = await logged();
    await service.markCarrierEventFailed(id);
    expect(logs.rows[0]!.status).toBe(WebhookLogStatus.FAILED);
  });
});
