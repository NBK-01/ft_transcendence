/**
 * Every kind of background job; the value is the BullMQ job name. Each one
 * needs an entry in JobDataMap, JOB_REGISTRY and HANDLER_REGISTRY (all
 * keyed by JobType, so a missing entry doesn't compile).
 */
export enum JobType {
  /** A shipment_event row was committed: notify the side that didn't cause it. */
  SHIPMENT_EVENT_NOTIFICATION = 'SHIPMENT_EVENT_NOTIFICATION',
  /** Something else was created, changed or deleted: notify whoever it affects. */
  ACTION_NOTIFICATION = 'ACTION_NOTIFICATION',
  /** A carrier's signed tracking update was logged: apply it once. */
  CARRIER_WEBHOOK = 'CARRIER_WEBHOOK',
}
