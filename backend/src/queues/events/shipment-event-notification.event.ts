/**
 * Data of a SHIPMENT_EVENT_NOTIFICATION job: a shipment_event row was
 * committed. Only its id travels; the handler reads the rest when it runs.
 */
export interface ShipmentEventNotificationEvent {
  shipmentEventId: string;
}
