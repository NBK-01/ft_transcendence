import { JobType } from '../../constants/job-type';
import { QueueName } from '../../constants/queue-name';
import { ShipmentEventNotificationEvent } from '../../events/shipment-event-notification.event';
import { JobDefinition } from '../../interfaces/job-definition.interface';

const DAY_SECONDS = 24 * 60 * 60;

export const ShipmentEventNotificationJob: JobDefinition<ShipmentEventNotificationEvent> =
  {
    name: JobType.SHIPMENT_EVENT_NOTIFICATION,
    queue: QueueName.STANDARD,
    // 1 try + 4 retries, 5s apart then doubling: about 75s in all.
    attempts: 5,
    backoff: { type: 'exponential', delay: 5_000 },
    // One job per event. Even past retention, the notification rows' own
    // dedupe keys stop a second job from creating anything twice.
    jobId: (data) => data.shipmentEventId,
    removeOnComplete: { age: DAY_SECONDS },
    removeOnFail: { age: 7 * DAY_SECONDS },
  };
