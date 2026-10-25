import { ShipmentState } from '../../shipments/constants/shipment-state';

/**
 * Delivery and read state of one notification row.
 *
 *   PENDING (created) → SENT (reached the user's live channel) | FAILED (gave up)
 *   → READ (the user read it; allowed from any status)
 */
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ',
}

/** What the notification is about. Frontends pick their own wording from this plus `payload`. */
export enum NotificationType {
  /** A new step on a shipment's timeline (any ShipmentEvent). */
  SHIPMENT_UPDATE = 'SHIPMENT_UPDATE',
}

export interface ShipmentUpdatePayload {
  trackingId: string;
  status: ShipmentState;
}

/**
 * What each type carries in `payload`: enough for a frontend to word the
 * notification in its own language and link to the thing it's about. The
 * stored title/message are English only (the backend has no other locale).
 */
export interface NotificationPayloads {
  [NotificationType.SHIPMENT_UPDATE]: ShipmentUpdatePayload;
}

export type NotificationPayload = NotificationPayloads[NotificationType];
