import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { bullmqConfig } from './config/bullmq.config';
import { QueueName } from './constants/queue-name';
import { QueueService } from './services/queue.service';
import { StandardJobsProcessor } from './processors/standard-jobs.processor';
import { ShipmentEventSubscriber } from './subscribers/shipment-event.subscriber';
import { ActionSubscriber } from './subscribers/action.subscriber';
import { ActionNotifier } from './services/action-notifier.service';
import { ActionSignalsListener } from './listeners/action-signals.listener';
import { WebhookSignalsListener } from './listeners/webhook-signals.listener';

/**
 * Background jobs on BullMQ. Each job type is an event (its data), a job
 * (registry entry: queue, attempts, backoff, retention, id) and a handler
 * (the logic), dispatched by name — see registry/. Jobs are only ever
 * added through QueueService.
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: bullmqConfig,
    }),
    BullModule.registerQueue(
      ...Object.values(QueueName).map((name) => ({ name })),
    ),
    NotificationsModule,
    WebhooksModule,
  ],
  providers: [
    QueueService,
    StandardJobsProcessor,
    ShipmentEventSubscriber,
    ActionNotifier,
    ActionSubscriber,
    ActionSignalsListener,
    WebhookSignalsListener,
  ],
  exports: [QueueService],
})
export class QueuesModule {}
