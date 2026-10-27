import { CarrierWebhookEvent } from '../events/carrier-webhook.event';
import { JobHandler } from '../interfaces/job-handler.interface';

/**
 * Applies a logged carrier event; see WebhooksService.processCarrierEvent
 * for what's retried. The job's id is its delivery's (CarrierWebhookJob),
 * and it holds the event's claim under it.
 */
export const carrierWebhookHandler: JobHandler<CarrierWebhookEvent> = {
  async run(job, services) {
    return {
      status: await services.webhooksService.processCarrierEvent(
        job.data.webhookLogId,
        job.data.deliveryId,
      ),
    };
  },

  async onFinalFailure(job, services) {
    await services.webhooksService.markCarrierEventFailed(
      job.data.webhookLogId,
      job.data.deliveryId,
    );
  },
};
