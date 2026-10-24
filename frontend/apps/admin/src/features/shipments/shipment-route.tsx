import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Shipment } from "@trans/api";
import { cn } from "@trans/ui/lib/utils";

/**
 * "Istanbul → Paris" on the shipment pages. Each city is its own flex item, so
 * the order and the arrow follow the reading direction (right to left in
 * Arabic) and a Latin city name never reorders an Arabic line. Screen readers
 * get a sentence instead. Before the payment is confirmed there's no route yet.
 */
export function ShipmentRoute({
  origin,
  destination,
  className,
}: Pick<Shipment, "origin" | "destination"> & { className?: string }) {
  const { t } = useTranslation("app");
  if (!origin || !destination) return <span className={cn("text-gray-900", className)}>{t("route.unknown")}</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="sr-only">{t("route.label", { origin, destination })}</span>
      <span aria-hidden="true" className="truncate">
        {origin}
      </span>
      <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-gray-900 rtl:-scale-x-100" />
      <span aria-hidden="true" className="truncate">
        {destination}
      </span>
    </span>
  );
}
