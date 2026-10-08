import { useTranslation } from "react-i18next";

import { Badge } from "@trans/ui/components/badge";
import { cn } from "@trans/ui/lib/utils";

export const SHIPMENT_STATUSES = [
  "requested",
  "confirmed",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

type Tone = "gray" | "blue" | "amber" | "green" | "red";

/** Status colours never use the brand orange. */
const TONE: Record<ShipmentStatus, Tone> = {
  requested: "gray",
  confirmed: "blue",
  in_transit: "amber",
  out_for_delivery: "amber",
  delivered: "green",
  cancelled: "red",
};

const DOT: Record<Tone, string> = {
  gray: "bg-gray-700",
  blue: "bg-blue-700",
  amber: "bg-amber-700",
  green: "bg-green-700",
  red: "bg-red-700",
};

/** "Live" states get a soft ping so moving shipments stand out in a list. */
const LIVE: ReadonlySet<ShipmentStatus> = new Set(["in_transit", "out_for_delivery"]);

export function StatusDot({ status, className }: { status: ShipmentStatus; className?: string }) {
  const tone = TONE[status];
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2 shrink-0", className)}>
      {LIVE.has(status) && (
        <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60 motion-reduce:hidden", DOT[tone])} />
      )}
      <span className={cn("relative size-2 rounded-full", DOT[tone])} />
    </span>
  );
}

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: ShipmentStatus;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const { t } = useTranslation("common");
  return (
    <Badge variant={TONE[status]} size={size} className={cn("gap-1.5", className)}>
      <StatusDot status={status} />
      {t(`status.${status}`)}
    </Badge>
  );
}
