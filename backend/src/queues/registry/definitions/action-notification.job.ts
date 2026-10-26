import { JobType } from '../../constants/job-type';
import { QueueName } from '../../constants/queue-name';
import { ActionNotificationEvent } from '../../events/action-notification.event';
import { JobDefinition } from '../../interfaces/job-definition.interface';

const DAY_SECONDS = 24 * 60 * 60;

export const ActionNotificationJob: JobDefinition<ActionNotificationEvent> = {
  name: JobType.ACTION_NOTIFICATION,
  queue: QueueName.STANDARD,
  // Same retry policy as the shipment notifications: 1 try + 4 retries.
  attempts: 5,
  backoff: { type: 'exponential', delay: 5_000 },
  // One job per occurrence of an action, e.g. "BRANCH_UPDATED-<id>-<updatedAt ms>".
  jobId: (data) => `${data.type}-${data.occurrence}`,
  removeOnComplete: { age: DAY_SECONDS },
  removeOnFail: { age: 7 * DAY_SECONDS },
};
