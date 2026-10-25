/**
 * Every kind of background job; the value is the BullMQ job name. Each one
 * needs an entry in JobDataMap, JOB_REGISTRY and HANDLER_REGISTRY (all
 * keyed by JobType, so a missing entry doesn't compile).
 */
export enum JobType {
  /** A shipment_event row was committed: notify the side that didn't cause it. */
  SHIPMENT_EVENT_NOTIFICATION = 'SHIPMENT_EVENT_NOTIFICATION',
}
