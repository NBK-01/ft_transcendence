import { JobType } from '../constants/job-type';
import { ShipmentEventNotificationEvent } from '../events/shipment-event-notification.event';

/** The data each job type carries. The registries and QueueService.enqueue are typed from it. */
export interface JobDataMap {
  [JobType.SHIPMENT_EVENT_NOTIFICATION]: ShipmentEventNotificationEvent;
}
