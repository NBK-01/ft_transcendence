import { CircleAlert, CircleCheck, Hourglass, Info, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { isForbidden, useAdminShipments, type AdminShipment } from "@trans/api";
import { ShipmentStateBadge } from "@trans/ui/blocks/shipment-state";
import { ShipmentStateBreakdown } from "@trans/ui/blocks/shipment-state-breakdown";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useBranchFilter } from "../branches/use-branch-filter";
import { useActivityTime } from "../messages/use-activity-time";
import { ShipmentRoute } from "../shipments/shipment-route";
import { COUNTED_STATES, totalOf, useShipmentCounts, type CountedState, type CountQuery } from "./api";
import { OverviewStat } from "./overview-stat";
import { queryState } from "./query-state";

type Counts = Record<CountedState, CountQuery>;

/** The admin's to-do: find a supplier, confirm a payment. */
const AWAITING: CountedState[] = ["pending_sourcing", "pending_payment_confirmation"];
const MOVING: CountedState[] = ["in_transit", "out_for_delivery"];

/** The shipments list filtered to one status (pass it through withBranch). */
const statusPath = (status: CountedState) => `/shipments?status=${status}`;

/**
 * Shipment numbers for "shipments:read:all" (admin, support): mount it only
 * for them. Every number covers all branches and all time: the API can't
 * filter shipments by branch or date yet.
 */
export function ShipmentsSection() {
  const { t } = useTranslation(["common", "app"]);
  const counts = useShipmentCounts();
  // Most recently updated first.
  const recent = useAdminShipments({ limit: 5 });
  const { withBranch } = useBranchFilter();

  // A 403 (the role changed since signing in) drops the section, not the page.
  if ([recent, ...Object.values(counts)].some((query) => isForbidden(query.error))) return null;

  const pick = (states: CountedState[]) => states.map((state) => counts[state]);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="shipments-heading">
      <div className="flex flex-col gap-1">
        <h2 id="shipments-heading" className="text-heading-20">
          {t("nav.shipments")}
        </h2>
        <p className="text-copy-14 text-gray-900">{t("app:overview.shipments.scope")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Two statuses each, and the list filters by one: the card links to each instead of being a link. */}
        <OverviewStat
          label={t("app:overview.shipments.awaiting")}
          icon={Hourglass}
          value={totalOf(pick(AWAITING))}
          description={<StatusLinks states={AWAITING} counts={counts} />}
          {...queryState(...pick(AWAITING))}
        />
        <OverviewStat
          label={t("app:overview.shipments.moving")}
          icon={Truck}
          value={totalOf(pick(MOVING))}
          description={<StatusLinks states={MOVING} counts={counts} />}
          {...queryState(...pick(MOVING))}
        />
        <OverviewStat
          to={withBranch(statusPath("delivered"))}
          label={t("app:overview.shipments.delivered")}
          icon={CircleCheck}
          value={totalOf([counts.delivered])}
          description={t("app:overview.shipments.allTime")}
          {...queryState(counts.delivered)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard counts={counts} />
        <RecentCard recent={recent} />
      </div>

      <p className="flex items-start gap-2 text-copy-13 text-pretty text-gray-900">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("app:overview.shipments.note")}
      </p>
    </section>
  );
}

/** "Pending sourcing: 3", one link per status, each to the list filtered to it. */
function StatusLinks({ states, counts }: { states: CountedState[]; counts: Counts }) {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {states.map((state) => (
        <Link
          key={state}
          to={withBranch(statusPath(state))}
          className="focus-ring rounded-sm underline decoration-gray-alpha-500 underline-offset-2 transition-colors duration-150 hover:text-gray-1000 hover:decoration-current"
        >
          {t("app:overview.shipments.statusCount", {
            status: t(`status.${state}`),
            count: counts[state].data?.meta.totalItems ?? 0,
          })}
        </Link>
      ))}
    </span>
  );
}

function BreakdownCard({ counts }: { counts: Counts }) {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  const queries = COUNTED_STATES.map((state) => counts[state]);
  const { isLoading, error, onRetry } = queryState(...queries);
  const total = totalOf(queries);

  return (
    <Card className="gap-4 p-5" aria-busy={isLoading || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-heading-16">{t("app:overview.shipments.byStatus")}</h3>
        {total !== undefined && (
          <p className="text-copy-13 text-gray-900 tabular-nums">{t("app:overview.shipments.total", { count: total })}</p>
        )}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-4">
          <span className="sr-only">{t("table.loading")}</span>
          <Skeleton className="h-3 w-full" />
          <div className="flex flex-col gap-3">
            {COUNTED_STATES.map((state) => (
              <Skeleton key={state} className="h-5 w-full" />
            ))}
          </div>
        </div>
      ) : error ? (
        <CardError onRetry={onRetry} />
      ) : (
        <ShipmentStateBreakdown
          label={t("app:overview.shipments.byStatus")}
          items={COUNTED_STATES.map((state) => ({
            state,
            count: counts[state].data?.meta.totalItems ?? 0,
            href: withBranch(statusPath(state)),
          }))}
        />
      )}
    </Card>
  );
}

/** The latest changes: the list's first page, which the API sorts by last update. */
function RecentCard({ recent }: { recent: ReturnType<typeof useAdminShipments> }) {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  const { isLoading, error, onRetry } = queryState(recent);
  const items = recent.data?.items ?? [];

  return (
    <Card className="gap-2 p-5" aria-busy={isLoading || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-heading-16">{t("app:overview.shipments.recent")}</h3>
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
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-copy-14 text-gray-900">{t("app:overview.shipments.recentEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-gray-alpha-400">
          {items.map((shipment) => (
            <RecentRow key={shipment.trackingId} shipment={shipment} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentRow({ shipment }: { shipment: AdminShipment }) {
  const { withBranch } = useBranchFilter();
  const activity = useActivityTime();
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            to={withBranch(`/shipments/${encodeURIComponent(shipment.trackingId)}`)}
            dir="ltr"
            className="focus-ring rounded-sm text-label-mono-14 text-gray-1000 hover:underline"
          >
            {shipment.trackingId}
          </Link>
          <ShipmentStateBadge status={shipment.status} size="sm" />
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-copy-13 text-gray-900">
          <span className="min-w-0 truncate">{shipment.client.name}</span>
          <span aria-hidden="true">·</span>
          <ShipmentRoute origin={shipment.origin} destination={shipment.destination} className="min-w-0 truncate" />
        </div>
      </div>
      <time dateTime={shipment.updatedAt} className="shrink-0 pt-0.5 text-label-12 text-gray-900 tabular-nums">
        {activity(shipment.updatedAt)}
      </time>
    </li>
  );
}

/** A card's content that couldn't load. */
function CardError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation("common");
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <CircleAlert className="size-5 text-red-700" aria-hidden="true" />
      <p className="text-copy-14 text-gray-900">{t("stat.error")}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        {t("table.retry")}
      </Button>
    </div>
  );
}
