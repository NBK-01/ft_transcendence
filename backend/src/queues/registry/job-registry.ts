import { JobType } from '../constants/job-type';
import { JobDataMap } from '../interfaces/job-data.interface';
import { JobDefinition } from '../interfaces/job-definition.interface';
import { ShipmentEventNotificationJob } from './definitions/shipment-event-notification.job';
import { ActionNotificationJob } from './definitions/action-notification.job';
import { CarrierWebhookJob } from './definitions/carrier-webhook.job';

/** One definition per job type; a missing one doesn't compile. */
export const JOB_REGISTRY: { [K in JobType]: JobDefinition<JobDataMap[K]> } = {
  [JobType.SHIPMENT_EVENT_NOTIFICATION]: ShipmentEventNotificationJob,
  [JobType.ACTION_NOTIFICATION]: ActionNotificationJob,
  [JobType.CARRIER_WEBHOOK]: CarrierWebhookJob,
};

/**
 * Deterministic: the same job type and data always give the same id, and
 * every type has to provide one (no fallback to a clock or random value).
 * Prefixed with the type, so two job types can never share an id.
 */
export function generateJobId<K extends JobType>(
  type: K,
  data: JobDataMap[K],
): string {
  return `${type}-${JOB_REGISTRY[type].jobId(data)}`;
}
