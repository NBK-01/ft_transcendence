import { JobType } from '../../constants/job-type';
import { QueueName } from '../../constants/queue-name';
import { CarrierWebhookEvent } from '../../events/carrier-webhook.event';
import { JobDefinition } from '../../interfaces/job-definition.interface';

const DAY_SECONDS = 24 * 60 * 60;

export const CarrierWebhookJob: JobDefinition<CarrierWebhookEvent> = {
  name: JobType.CARRIER_WEBHOOK,
  queue: QueueName.STANDARD,
  // 1 try + 4 retries for what a retry can fix (a database blip); the
  // handler fails what it can't fix (an unknown tracking ID) at once.
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  // One job per delivery: a redelivery of a FAILED event can queue it again.
  jobId: (data) => data.deliveryId,
  removeOnComplete: { age: DAY_SECONDS },
  removeOnFail: { age: 7 * DAY_SECONDS },
};
