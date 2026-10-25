import { JobType } from '../constants/job-type';
import { JobDataMap } from '../interfaces/job-data.interface';
import { JobHandler } from '../interfaces/job-handler.interface';
import { UnknownJobTypeException } from '../exceptions';
import { shipmentEventNotificationHandler } from '../handlers/shipment-event-notification.handler';

/** One handler per job type; a missing one doesn't compile. */
export const HANDLER_REGISTRY: { [K in JobType]: JobHandler<JobDataMap[K]> } = {
  [JobType.SHIPMENT_EVENT_NOTIFICATION]: shipmentEventNotificationHandler,
};

export function isJobType(name: string): name is JobType {
  return (Object.values(JobType) as string[]).includes(name);
}

/** How the processors dispatch: the job's name picks its handler. */
export function handlerFor(name: string): JobHandler<unknown> {
  if (!isJobType(name)) {
    throw new UnknownJobTypeException(name);
  }
  return HANDLER_REGISTRY[name] as JobHandler<unknown>;
}
