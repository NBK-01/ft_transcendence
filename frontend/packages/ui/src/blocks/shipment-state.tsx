import { useTranslation } from "react-i18next";

import { SHIPMENT_STATUSES, StatusBadge, StatusDot, type ShipmentStatus } from "@trans/ui/blocks/status";
import { Badge } from "@trans/ui/components/badge";
import { cn } from "@trans/ui/lib/utils";

/**
 * Order stages: what happens to a client's request before tracking starts.
 *   pending_sourcing → pending_client_decision → (reject: back to pending_sourcing)
 *   → pending_payment → pending_payment_confirmation → confirmed (tracking starts)
 * Labels live next to the tracking ones, under `status.*` in the common strings.
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

/** The admin has the next move (find a supplier, confirm a payment). Client screens poll here. */
export const WAITING_ON_ADMIN: ReadonlySet<ShipmentState> = new Set(["pending_sourcing", "pending_payment_confirmation"]);

/** The client has the next move (approve or reject the offer, pay). */
export const CLIENT_ACTION: ReadonlySet<ShipmentState> = new Set(["pending_client_decision", "pending_payment"]);

/**
 * Stage colours: a quiet outline while waiting on the admin, blue when it's the
 * client's turn. Like the tracking statuses, never the brand orange.
 */
const STAGE_BADGE: Record<OrderStage, "outline" | "blue"> = {
  pending_sourcing: "outline",
  pending_client_decision: "blue",
  pending_payment: "blue",
  pending_payment_confirmation: "outline",
};

/** Dot for any state: the tracking StatusDot, or a stage dot that pulses on the client's turn. */
export function ShipmentStateDot({ status, className }: { status: ShipmentState; className?: string }) {
  if (!isOrderStage(status)) return <StatusDot status={status} className={className} />;
  const color = STAGE_BADGE[status] === "blue" ? "bg-blue-700" : "bg-gray-700";
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2 shrink-0", className)}>
      {CLIENT_ACTION.has(status) && (
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden", color)} />
      )}
      <span className={cn("relative size-2 rounded-full", color)} />
    </span>
  );
}

/** Badge for any state: the tracking StatusBadge, or a stage badge for the four order stages. */
export function ShipmentStateBadge({
  status,
  size = "md",
  className,
}: {
  status: ShipmentState;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useTranslation("common");
  if (!isOrderStage(status)) return <StatusBadge status={status} size={size} className={className} />;
  return (
    <Badge variant={STAGE_BADGE[status]} size={size} className={cn("gap-1.5", className)}>
      <ShipmentStateDot status={status} />
      {t(`status.${status}`)}
    </Badge>
  );
}
