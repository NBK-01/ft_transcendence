/**
 * Everything a shipment's `status` can be. The first four are order stages
 * (before tracking starts), the rest are tracking statuses. Same strings as
 * the frontend's ShipmentState (packages/ui/src/blocks/shipment-state.tsx).
 *
 *   pending_sourcing → pending_client_decision → (reject: back to pending_sourcing)
 *   → pending_payment → pending_payment_confirmation → confirmed
 *   → in_transit → out_for_delivery → delivered   (cancelled from any non-final state)
 */
export enum ShipmentState {
  PENDING_SOURCING = 'pending_sourcing',
  PENDING_CLIENT_DECISION = 'pending_client_decision',
  PENDING_PAYMENT = 'pending_payment',
  PENDING_PAYMENT_CONFIRMATION = 'pending_payment_confirmation',
  /** Kept for parity with the frontend's status list; nothing sets it today. */
  REQUESTED = 'requested',
  CONFIRMED = 'confirmed',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

/** Statuses an admin can move a shipment to with a tracking event, and from where. */
export const TRACKING_TRANSITIONS: Partial<
  Record<ShipmentState, ShipmentState[]>
> = {
  [ShipmentState.IN_TRANSIT]: [
    ShipmentState.CONFIRMED,
    ShipmentState.IN_TRANSIT,
    ShipmentState.OUT_FOR_DELIVERY,
  ],
  [ShipmentState.OUT_FOR_DELIVERY]: [ShipmentState.IN_TRANSIT],
  [ShipmentState.DELIVERED]: [ShipmentState.OUT_FOR_DELIVERY],
  [ShipmentState.CANCELLED]: [
    ShipmentState.PENDING_SOURCING,
    ShipmentState.PENDING_CLIENT_DECISION,
    ShipmentState.PENDING_PAYMENT,
    ShipmentState.PENDING_PAYMENT_CONFIRMATION,
    ShipmentState.CONFIRMED,
    ShipmentState.IN_TRANSIT,
    ShipmentState.OUT_FOR_DELIVERY,
  ],
};

/** Order stages are done once payment is confirmed: from here on the shipment has a route, weight and declared value. */
export const LIVE_STATES: readonly ShipmentState[] = [
  ShipmentState.CONFIRMED,
  ShipmentState.IN_TRANSIT,
  ShipmentState.OUT_FOR_DELIVERY,
  ShipmentState.DELIVERED,
  ShipmentState.CANCELLED,
];

export enum ShipmentFileKind {
  /** Photos the client sent with the request. */
  REQUEST_PHOTO = 'request_photo',
  /** Photos the admin attached to a supplier offer. */
  OFFER_PHOTO = 'offer_photo',
  PACKAGE_PHOTO = 'package_photo',
  PROOF_OF_DELIVERY = 'proof_of_delivery',
  OTHER = 'other',
}

/** The kinds the Files tab lists (request and offer photos show on the detail page instead). */
export const ATTACHMENT_KINDS = [
  ShipmentFileKind.PACKAGE_PHOTO,
  ShipmentFileKind.PROOF_OF_DELIVERY,
  ShipmentFileKind.OTHER,
] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const MAX_REQUEST_IMAGES = 5;
