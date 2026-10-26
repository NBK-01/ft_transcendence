import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { ActivityActor, ShipmentActivity } from "@trans/api";
import { ShipmentStateBadge } from "@trans/ui/blocks/shipment-state";
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useBranchFilter } from "../branches/use-branch-filter";
import { useActivityTime } from "../messages/use-activity-time";
import { CardError } from "./card-error";

type AppT = ReturnType<typeof useTranslation<"app">>["t"];

type Props = {
  activity: ShipmentActivity[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
};

/** The latest shipment events, newest first: what happened, where, and who did it. */
export function ActivityCard({ activity, isLoading, error, onRetry }: Props) {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();

  return (
    <Card className="gap-2 p-5" aria-busy={isLoading || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-heading-16">{t("app:overview.activity.title")}</h3>
        <Link
          to={withBranch("/shipments")}
          className="focus-ring shrink-0 rounded-sm text-label-14 text-gray-900 transition-colors duration-150 hover:text-gray-1000 hover:underline"
        >
          {t("app:overview.shipments.viewAll")}
        </Link>
      </div>
      {isLoading ? (
        <div className="flex flex-col">
          <span className="sr-only">{t("table.loading")}</span>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2 py-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56 max-w-full" />
            </div>
          ))}
        </div>
      ) : error ? (
        <CardError onRetry={onRetry} />
      ) : !activity?.length ? (
        <p className="py-8 text-center text-copy-14 text-gray-900">{t("app:overview.activity.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-alpha-400">
          {activity.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function ActivityRow({ item }: { item: ShipmentActivity }) {
  const { t } = useTranslation("app");
  const { withBranch } = useBranchFilter();
  const time = useActivityTime();
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={withBranch(`/shipments/${encodeURIComponent(item.trackingId)}`)}
            dir="ltr"
            className="focus-ring rounded-sm text-label-mono-14 text-gray-1000 hover:underline"
          >
            {item.trackingId}
          </Link>
          <ShipmentStateBadge status={item.status} size="sm" />
        </div>
        <p className="flex min-w-0 items-center gap-1.5 text-copy-13 text-gray-900">
          <span className="min-w-0 truncate">
            <bdi>{item.location}</bdi>
          </span>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate">{actorLabel(t, item.actor)}</span>
        </p>
      </div>
      <time dateTime={item.occurredAt} className="shrink-0 pt-0.5 text-label-12 text-gray-900 tabular-nums">
        {time(item.occurredAt)}
      </time>
    </li>
  );
}

/** "Nadia Haddad (staff)", "Warehouse system (Beirut Central API key)", "The carrier", or "Not recorded" for an old event. */
function actorLabel(t: AppT, actor: ActivityActor | null) {
  if (!actor) return t("overview.activity.actor.unknown");
  const name = actor.name ?? t("overview.activity.actor.someone");
  switch (actor.type) {
    case "customer":
      return t("overview.activity.actor.customer", { name });
    case "staff":
      return t("overview.activity.actor.staff", { name });
    case "partner":
      return actor.organization
        ? t("overview.activity.actor.partnerBranch", { name, branch: actor.organization.name })
        : t("overview.activity.actor.partner", { name });
    case "carrier":
      return t("overview.activity.actor.carrier");
  }
}
