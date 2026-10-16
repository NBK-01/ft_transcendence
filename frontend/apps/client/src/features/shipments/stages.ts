import { SHIPMENT_STATUSES, type ShipmentStatus } from "@trans/ui/blocks/status";

/**
 * Order stages before tracking starts. A client request goes:
 *   pending_sourcing → pending_client_decision → (reject: back to pending_sourcing)
 *   → pending_payment → pending_payment_confirmation → confirmed (tracking starts)
 * The shared StatusBadge only knows the tracking statuses, so these live here.
 */
export const ORDER_STAGES = [
  "pending_sourcing",
  "pending_client_decision",
  "pending_payment",
  "pending_payment_confirmation",
] as const;
export type OrderStage = (typeof ORDER_STAGES)[number];

/** Everything a shipment's `status` can be: an order stage or a tracking status. */
export type ShipmentState = OrderStage | ShipmentStatus;
export const SHIPMENT_STATES: readonly ShipmentState[] = [...ORDER_STAGES, ...SHIPMENT_STATUSES];

export const isOrderStage = (value: unknown): value is OrderStage => ORDER_STAGES.includes(value as OrderStage);

export const isShipmentState = (value: unknown): value is ShipmentState =>
  SHIPMENT_STATES.includes(value as ShipmentState);

/** Stages where the client is waiting on the admin; the page polls for changes. */
export const WAITING_ON_ADMIN: ReadonlySet<ShipmentState> = new Set(["pending_sourcing", "pending_payment_confirmation"]);

/** Stages where the client has to act. */
export const CLIENT_ACTION: ReadonlySet<ShipmentState> = new Set(["pending_client_decision", "pending_payment"]);

/** i18n key for any state: tracking statuses come from the shared "common" strings, stages from "app". */
export const stateLabelKey = (state: ShipmentState) =>
  isOrderStage(state) ? `app:shipments.stage.${state}` : `common:status.${state}`;
