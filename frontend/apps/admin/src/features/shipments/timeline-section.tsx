import { useTranslation } from "react-i18next";

import { useAdminShipmentEvents } from "@trans/api";
import { TimelineList } from "@trans/ui/blocks/timeline";
import { Skeleton } from "@trans/ui/components/skeleton";

import { DetailSection, SectionError } from "./detail-parts";

/** The shipment's history, newest first. Loads on its own, so a failure here leaves the rest of the page up. */
export function TimelineSection({ trackingId }: { trackingId: string }) {
  const { t } = useTranslation("app");
  const events = useAdminShipmentEvents(trackingId);

  return (
    <DetailSection title={t("shipment.timeline.title")}>
      {events.isPending ? (
        <TimelineRowsSkeleton />
      ) : events.isError ? (
        <SectionError
          message={t("shipment.timeline.error")}
          onRetry={() => void events.refetch()}
          retrying={events.isFetching}
        />
      ) : events.data.length === 0 ? (
        <p className="text-copy-14 text-gray-900">{t("shipment.timeline.empty")}</p>
      ) : (
        // The card is already drawn here, so the list goes in without its own.
        <TimelineList events={events.data} className="p-0" />
      )}
    </DetailSection>
  );
}

/** The shape of TimelineList's rows, without TimelineSkeleton's card. */
function TimelineRowsSkeleton() {
  const { t } = useTranslation("common");
  return (
    <div aria-busy="true">
      <span className="sr-only">{t("table.loading")}</span>
      <ul aria-hidden="true" className="flex flex-col gap-5">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="flex items-start gap-3">
            <Skeleton className="mt-1.5 size-2 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
            </div>
            <Skeleton className="h-3 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}
