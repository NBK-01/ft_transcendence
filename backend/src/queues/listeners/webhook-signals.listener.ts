import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  CarrierEventReceivedSignal,
  WebhookSignals,
} from '../../webhooks/webhook-signals';
import { JobType } from '../constants/job-type';
import { QueueService } from '../services/queue.service';

/**
 * Queues the job for a logged webhook delivery. WebhooksService awaits it
 * (emitAsync) and errors aren't suppressed: a failed enqueue fails the
 * request, so the provider redelivers.
 */
@Injectable()
export class WebhookSignalsListener {
  constructor(private readonly queueService: QueueService) {}

  @OnEvent(WebhookSignals.CARRIER_EVENT_RECEIVED, { suppressErrors: false })
  async onCarrierEventReceived(
    signal: CarrierEventReceivedSignal,
  ): Promise<void> {
    await this.queueService.enqueue(JobType.CARRIER_WEBHOOK, signal);
  }
}
