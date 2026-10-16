import { useTranslation } from "react-i18next";

import { StatusBadge, StatusDot } from "@trans/ui/blocks/status";
import { Badge } from "@trans/ui/components/badge";
import { cn } from "@trans/ui/lib/utils";

import { CLIENT_ACTION, isOrderStage, stateLabelKey, type OrderStage, type ShipmentState } from "./stages";

/**
 * Order stages: quiet outline while waiting on the admin, blue (with a ping)
 * when it's the client's turn. Never the brand orange, like the shared statuses.
 */
const STAGE_BADGE: Record<OrderStage, "outline" | "blue"> = {
  pending_sourcing: "outline",
  pending_client_decision: "blue",
  pending_payment: "blue",
  pending_payment_confirmation: "outline",
};

/** Dot for any state: the shared StatusDot for tracking statuses, a stage dot otherwise. */
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

/** Badge for any state: the shared StatusBadge for tracking statuses, a stage badge otherwise. */
export function ShipmentStateBadge({
  status,
  size = "md",
  className,
}: {
  status: ShipmentState;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useTranslation();
  if (!isOrderStage(status)) return <StatusBadge status={status} size={size} className={className} />;
  return (
    <Badge variant={STAGE_BADGE[status]} size={size} className={cn("gap-1.5", className)}>
      <ShipmentStateDot status={status} />
      {t(stateLabelKey(status))}
    </Badge>
  );
}
