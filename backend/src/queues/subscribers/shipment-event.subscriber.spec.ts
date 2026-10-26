import {
  DataSource,
  InsertEvent,
  ObjectLiteral,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { ShipmentEvent } from '../../shipments/entities/shipment-event.entity';
import { QueueService } from '../services/queue.service';
import { ShipmentEventSubscriber } from './shipment-event.subscriber';

/** The two QueryRunner fields the subscriber reads, as TypeORM leaves them at each hook. */
interface FakeQueryRunner {
  isTransactionActive: boolean;
  data: ObjectLiteral;
}

describe('ShipmentEventSubscriber', () => {
  let enqueue: jest.Mock;
  let dataSource: { subscribers: unknown[] };
  let subscriber: ShipmentEventSubscriber;
  let queryRunner: FakeQueryRunner;

  const inserted = (id: string) =>
    subscriber.afterInsert({
      entity: { id },
      queryRunner,
    } as unknown as InsertEvent<ShipmentEvent>);
  const committed = () =>
    subscriber.afterTransactionCommit({
      queryRunner,
    } as unknown as TransactionCommitEvent);
  const rolledBack = () =>
    subscriber.afterTransactionRollback({
      queryRunner,
    } as unknown as TransactionRollbackEvent);
  const enqueuedIds = () =>
    enqueue.mock.calls.map(
      (call) =>
        (call as [string, { shipmentEventId: string }])[1].shipmentEventId,
    );

  beforeEach(() => {
    enqueue = jest.fn().mockResolvedValue(undefined);
    dataSource = { subscribers: [] };
    subscriber = new ShipmentEventSubscriber(
      dataSource as unknown as DataSource,
      { enqueue } as unknown as QueueService,
    );
    queryRunner = { isTransactionActive: true, data: {} };
  });

  it('registers itself with TypeORM', () => {
    expect(dataSource.subscribers).toEqual([subscriber]);
  });

  it('enqueues nothing until the transaction commits, then one job per event', () => {
    inserted('event-1');
    inserted('event-2');
    expect(enqueue).not.toHaveBeenCalled();

    queryRunner.isTransactionActive = false; // what COMMIT leaves behind
    committed();

    expect(enqueue).toHaveBeenCalledWith('SHIPMENT_EVENT_NOTIFICATION', {
      shipmentEventId: 'event-1',
    });
    expect(enqueuedIds()).toEqual(['event-1', 'event-2']);
  });

  it('enqueues nothing on rollback, not even at a later commit on the same runner', () => {
    inserted('event-1');
    queryRunner.isTransactionActive = false;
    rolledBack();

    queryRunner.isTransactionActive = true;
    inserted('event-2');
    queryRunner.isTransactionActive = false;
    committed();

    expect(enqueuedIds()).toEqual(['event-2']);
  });

  it('waits for the outer commit when only a savepoint was released', () => {
    inserted('event-1');
    committed(); // RELEASE SAVEPOINT: the transaction is still open
    expect(enqueue).not.toHaveBeenCalled();

    queryRunner.isTransactionActive = false;
    committed();

    expect(enqueuedIds()).toEqual(['event-1']);
  });

  it('enqueues right away an insert made outside a transaction (already committed)', () => {
    queryRunner.isTransactionActive = false;

    inserted('event-1');

    expect(enqueuedIds()).toEqual(['event-1']);
  });

  it('logs a failed enqueue instead of throwing into the committed request', async () => {
    enqueue.mockRejectedValue(new Error('Redis is down'));
    const logged = jest
      .spyOn(subscriber['logger'], 'error')
      .mockImplementation(() => {});
    queryRunner.isTransactionActive = false;

    expect(() => inserted('event-1')).not.toThrow();
    await new Promise(setImmediate);

    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('shipment event event-1'),
    );
  });
});
