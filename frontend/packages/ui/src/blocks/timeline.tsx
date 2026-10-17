import { useTranslation } from "react-i18next";

import { ShipmentStateDot, type ShipmentState } from "@trans/ui/blocks/shipment-state";
import { Skeleton } from "@trans/ui/components/skeleton";
import { cn } from "@trans/ui/lib/utils";

export type TimelineEvent = {
  status: ShipmentState;
  /** Where it happened, or a short note, e.g. "Lyon hub" or "Offer approved". */
  location: string;
  /** ISO 8601 timestamp. */
  occurredAt: string;
};

const CARD = "w-full rounded-xl border border-gray-alpha-400 bg-background-100";

/**
 * A shipment's history, newest first: the latest event gets its status dot,
 * earlier ones a quiet grey dot. Same look as the sign-in panel's tracking card
 * (AuthLayout), but real and readable by screen readers.
 * Draws only; the caller loads the events and handles loading, error and empty.
 */
export function Timeline({ events, label, className }: { events: TimelineEvent[]; label?: string; className?: string }) {
  const { t, i18n } = useTranslation("common");
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className={cn(CARD, className)}>
      <ol aria-label={label ?? t("timeline.label")} className="flex flex-col px-5 py-4">
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
                    {t(`status.${event.status}`)}
                  </span>
                  <span className="truncate text-label-13 text-gray-900">{event.location}</span>
                </div>
                <time dateTime={event.occurredAt} className="shrink-0 text-label-mono-12 text-gray-900 tabular-nums">
                  {date.format(new Date(event.occurredAt))}
                </time>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Placeholder with the Timeline's shape, for while events load. */
export function TimelineSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div aria-busy="true" className={cn(CARD, className)}>
      <ul className="flex flex-col gap-5 px-5 py-4">
        {Array.from({ length: rows }, (_, index) => (
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
