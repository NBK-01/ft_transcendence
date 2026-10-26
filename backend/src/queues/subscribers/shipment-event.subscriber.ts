import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  InsertEvent,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { ShipmentEvent } from '../../shipments/entities/shipment-event.entity';
import { JobType } from '../constants/job-type';
import { QueueService } from '../services/queue.service';
import { AfterCommit } from './after-commit';

/**
 * The trigger: every shipment_event row fans out notifications, with no
 * change to the Shipments module. ShipmentsService writes events with
 * manager.insert() inside its transactions, which still runs subscribers.
 * An event is only enqueued once its transaction commits (AfterCommit), so a
 * rollback never notifies anyone and the job always finds the row.
 */
@Injectable()
export class ShipmentEventSubscriber implements EntitySubscriberInterface<ShipmentEvent> {
  private readonly logger = new Logger(ShipmentEventSubscriber.name);
  private readonly afterCommit = new AfterCommit('pendingShipmentEvents');

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
    if (id) {
      this.afterCommit.schedule(event.queryRunner, () => this.enqueue(id));
    }
  }

  afterTransactionCommit(event: TransactionCommitEvent): void {
    this.afterCommit.committed(event.queryRunner);
  }

  afterTransactionRollback(event: TransactionRollbackEvent): void {
    this.afterCommit.rolledBack(event.queryRunner);
  }

  /**
   * Not awaited: the transaction has committed, so the request shouldn't
   * wait on Redis or fail because of it. A failure is logged instead.
   */
  private enqueue(shipmentEventId: string): void {
    this.queueService
      .enqueue(JobType.SHIPMENT_EVENT_NOTIFICATION, { shipmentEventId })
      .catch((error: unknown) =>
        this.logger.error(
          `Could not enqueue notifications for shipment event ${shipmentEventId}: ${String(error)}`,
        ),
      );
  }
}
