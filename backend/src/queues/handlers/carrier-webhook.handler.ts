import { CarrierWebhookEvent } from '../events/carrier-webhook.event';
import { JobHandler } from '../interfaces/job-handler.interface';

/** Applies a logged carrier event; see WebhooksService.processCarrierEvent for what's retried. */
export const carrierWebhookHandler: JobHandler<CarrierWebhookEvent> = {
  async run(job, services) {
    return {
      status: await services.webhooksService.processCarrierEvent(
        job.data.webhookLogId,
      ),
    };
  },

  async onFinalFailure(job, services) {
    await services.webhooksService.markCarrierEventFailed(
      job.data.webhookLogId,
    );
  },
};
