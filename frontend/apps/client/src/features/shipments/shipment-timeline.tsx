import { History, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { EmptyState } from "@trans/ui/blocks/empty-state";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";
import { cn } from "@trans/ui/lib/utils";

import { useShipmentEvents } from "./api";
import { formatAbsolute } from "./format-time";
import { stateLabelKey } from "./stages";
import { ShipmentStateDot } from "./state-badge";

/** Same frame as the tracking card on the sign-in panel (AuthLayout). */
const CARD = "w-full max-w-2xl rounded-xl border border-gray-alpha-400 bg-background-100";

/**
 * A shipment's history, newest first — the onboarding panel's timeline
 * (packages/ui/src/blocks/auth-layout.tsx) rebuilt for real data: the latest
 * event gets the live status dot, earlier ones a quiet grey dot.
 */
export function ShipmentTimeline({ trackingId }: { trackingId: string }) {
  const { t, i18n } = useTranslation(["common", "app"]);
  const { data: events, isPending, isError, refetch, isFetching } = useShipmentEvents(trackingId);

  if (isPending) return <TimelineSkeleton />;

  if (isError) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title={t("app:shipments.timelineErrorTitle")}
        description={t("app:shipments.errorBody")}
        action={
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            {t("app:shipments.retry")}
          </Button>
        }
      />
    );
  }

  if (events.length === 0) {
    return <EmptyState icon={History} title={t("app:shipments.timelineEmpty")} />;
  }

  return (
    <div className={CARD}>
      <ol aria-label={t("app:shipments.timelineLabel")} className="flex flex-col px-5 py-4">
        {events.map((event, index) => {
          const latest = index === 0;
          return (
            <li key={`${event.occurredAt}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
              {index < events.length - 1 && (
                <span aria-hidden="true" className="absolute start-[3.5px] top-4 bottom-0 w-px bg-gray-alpha-400" />
              )}
              <span className="pt-1.5">
                {latest ? (
                  <ShipmentStateDot status={event.status} />
                ) : (
                  <span aria-hidden="true" className="block size-2 rounded-full bg-gray-alpha-600" />
                )}
              </span>
              <div className="flex min-w-0 flex-1 items-baseline justify-between gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className={cn("text-label-14", latest ? "font-medium text-gray-1000" : "text-gray-900")}>
                    {t(stateLabelKey(event.status))}
                  </span>
                  <span className="truncate text-label-13 text-gray-900">{event.location}</span>
                </div>
                <time
                  dateTime={event.occurredAt}
                  className="shrink-0 text-label-mono-12 text-gray-900 tabular-nums"
                >
                  {formatAbsolute(event.occurredAt, i18n.language)}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div aria-busy="true" className={CARD}>
      <ul className="flex flex-col gap-5 px-5 py-4">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className="flex items-start gap-3">
            <Skeleton className="mt-1.5 size-2 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
            <Skeleton className="h-3 w-24" />
          </li>
        ))}
      </ul>
    </div>
  );
}
