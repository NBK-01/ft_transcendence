import { ShipmentState } from '../../shipments/constants/shipment-state';

/** Who sends us webhooks. One for now: a carrier posting tracking updates. */
export enum WebhookProvider {
  CARRIER = 'carrier',
}

/**
 * One row per delivery of a webhook (see WebhookLog):
 *
 *   RECEIVED (stored, queued) → PROCESSING (a job has it) → PROCESSED | FAILED
 *   DUPLICATE: a redelivery of an event we already have; it's logged, never processed.
 */
export enum WebhookLogStatus {
  RECEIVED = 'RECEIVED',
  PROCESSING = 'PROCESSING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  DUPLICATE = 'DUPLICATE',
}

/** `t={unix seconds},v1={hex HMAC-SHA256 of "{t}.{raw body}"}`, Stripe-style. */
export const CARRIER_SIGNATURE_HEADER = 'carrier-signature';

/** A signature older or newer than this (in seconds) is refused, so a captured request can't be replayed later. */
export const REPLAY_WINDOW_SECONDS = 5 * 60;

/** The carrier events we act on. Others are acknowledged and ignored. */
export const CARRIER_TRACKING_UPDATED = 'tracking.updated';

/** What a carrier may report: the moves an admin's tracking update allows. Cancelling stays ours. */
export const CARRIER_TRACKING_STATUSES = [
  ShipmentState.IN_TRANSIT,
  ShipmentState.OUT_FOR_DELIVERY,
  ShipmentState.DELIVERED,
] as const;
export type CarrierTrackingStatus = (typeof CARRIER_TRACKING_STATUSES)[number];
