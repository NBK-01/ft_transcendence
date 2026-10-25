import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  ObjectLiteral,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { ShipmentEvent } from '../../shipments/entities/shipment-event.entity';
import { JobType } from '../constants/job-type';
import { QueueService } from '../services/queue.service';

/** Where afterInsert keeps a transaction's event ids until it commits. */
const PENDING_KEY = 'pendingShipmentEventIds';

/**
 * The trigger: every shipment_event row fans out notifications, with no
 * change to the Shipments module. ShipmentsService writes events with
 * manager.insert() inside its transactions, which still runs subscribers.
 *
 * An event is only enqueued once its transaction commits, so a rollback
 * never notifies anyone and the job always finds the row. If the process
 * dies between the commit and the enqueue, that notification is lost
 * (there's no outbox).
 */
@Injectable()
export class ShipmentEventSubscriber implements EntitySubscriberInterface<ShipmentEvent> {
  private readonly logger = new Logger(ShipmentEventSubscriber.name);

  // Added by hand: the DataSource is built from options that list no
  // subscribers, and this one needs Nest's DI for QueueService anyway.
  constructor(
    dataSource: DataSource,
    private readonly queueService: QueueService,
  ) {
    dataSource.subscribers.push(this);
  }

  listenTo() {
    return ShipmentEvent;
  }

  afterInsert(event: InsertEvent<ShipmentEvent>): void {
    const id = event.entity?.id;
    if (!id) {
      return;
    }
    // Outside a transaction the insert has already committed on its own.
    if (!event.queryRunner.isTransactionActive) {
      this.enqueue([id]);
      return;
    }
    pendingIds(event.queryRunner.data).push(id);
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    // Releasing a savepoint also "commits"; wait for the outer COMMIT.
    if (event.queryRunner.isTransactionActive) {
      return;
    }
    const ids = takePendingIds(event.queryRunner.data);
    if (ids.length) {
      this.enqueue(ids);
    }
  }

  /**
   * Drops everything waiting, even after a rollback to a savepoint, which
   * could also drop events written before it: a missed notification beats
   * one about an event that never happened. Nothing nests transactions today.
   */
  afterTransactionRollback(event: TransactionRollbackEvent): void {
    takePendingIds(event.queryRunner.data);
  }

  /**
   * Not awaited: the transaction has committed, so the request shouldn't
   * wait on Redis or fail because of it. A failure is logged instead.
   */
  private enqueue(ids: string[]): void {
    for (const shipmentEventId of new Set(ids)) {
      this.queueService
        .enqueue(JobType.SHIPMENT_EVENT_NOTIFICATION, { shipmentEventId })
        .catch((error: unknown) =>
          this.logger.error(
            `Could not enqueue notifications for shipment event ${shipmentEventId}: ${String(error)}`,
          ),
        );
    }
  }
}

function pendingIds(data: ObjectLiteral): string[] {
  data[PENDING_KEY] ??= [];
  return data[PENDING_KEY] as string[];
}

function takePendingIds(data: ObjectLiteral): string[] {
  const ids = (data[PENDING_KEY] as string[] | undefined) ?? [];
  delete data[PENDING_KEY];
  return ids;
}
