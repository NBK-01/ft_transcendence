import { History, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Timeline, TimelineSkeleton } from "@trans/ui/blocks/timeline";
import { Button } from "@trans/ui/components/button";

import { useShipmentEvents } from "./api";

/**
 * Timeline tab: loads the shipment's events and handles loading, error and
 * empty. The drawing itself is the shared Timeline (@trans/ui), also used by admin.
 */
export function ShipmentTimeline({ trackingId }: { trackingId: string }) {
  const { t } = useTranslation("app");
  const { data: events, isPending, isError, refetch, isFetching } = useShipmentEvents(trackingId);

  if (isPending) return <TimelineSkeleton className="max-w-2xl" />;

  if (isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title={t("shipments.timelineErrorTitle")}
        description={t("shipments.errorBody")}
        action={
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            {t("shipments.retry")}
          </Button>
        }
      />
    );
  }

  if (events.length === 0) {
    return <EmptyState icon={History} title={t("shipments.timelineEmpty")} />;
  }

  return <Timeline events={events} className="max-w-2xl" />;
}
