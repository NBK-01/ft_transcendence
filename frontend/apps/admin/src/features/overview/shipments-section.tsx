import { CircleCheck, Hourglass, PackagePlus, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { isForbidden, type OverviewStats } from "@trans/api";
import { ShipmentStateBreakdown } from "@trans/ui/blocks/shipment-state-breakdown";
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useOrganizations } from "../branches/api";
import { useBranchFilter } from "../branches/use-branch-filter";
import { ActivityCard } from "./activity-card";
import { changeOf, COUNTED_STATES, useTodayOverview, type CountedState } from "./api";
import { CardError } from "./card-error";
import { OverviewStat } from "./overview-stat";
import { queryState } from "./query-state";

type ByStatus = OverviewStats["byStatus"];

/** The admin's to-do: find a supplier, confirm a payment. */
const AWAITING: CountedState[] = ["pending_sourcing", "pending_payment_confirmation"];
const MOVING: CountedState[] = ["in_transit", "out_for_delivery"];

/** The shipments list filtered to one status (pass it through withBranch). */
const statusPath = (status: CountedState) => `/shipments?status=${status}`;

const sumOf = (byStatus: ByStatus | undefined, states: CountedState[]) =>
  byStatus && states.reduce((sum, state) => sum + byStatus[state], 0);

/**
 * Shipment numbers for "shipments:read:all" (admin, support): mount it only
 * for them. One request (GET /admin/stats/overview): what's waiting and moving
 * now, what was created and delivered today against yesterday, every status,
 * and who did what last. All of it follows the top bar's branch filter.
 */
export function ShipmentsSection() {
  const { t } = useTranslation(["common", "app"]);
  const stats = useTodayOverview();
  const { branchId } = useBranchFilter();
  const branch = useOrganizations().data?.find((org) => org.id === branchId);

  // A 403 (the role changed since signing in) drops the section, not the page.
  if (isForbidden(stats.error)) return null;

  const state = queryState(stats);
  const data = stats.data;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="shipments-heading">
      <div className="flex flex-col gap-1">
        <h2 id="shipments-heading" className="text-heading-20">
          {t("nav.shipments")}
        </h2>
        <p className="text-copy-14 text-pretty text-gray-900">
          {branch
            ? t("app:overview.shipments.scopeBranch", { branch: branch.name })
            : t("app:overview.shipments.scope")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {/* Two statuses each, and the list filters by one: the card links to each instead of being a link. */}
        <OverviewStat
          label={t("app:overview.shipments.awaiting")}
          icon={Hourglass}
          value={sumOf(data?.byStatus, AWAITING)}
          description={data && <StatusLinks states={AWAITING} byStatus={data.byStatus} />}
          {...state}
        />
        <OverviewStat
          label={t("app:overview.shipments.moving")}
          icon={Truck}
          value={sumOf(data?.byStatus, MOVING)}
          description={data && <StatusLinks states={MOVING} byStatus={data.byStatus} />}
          {...state}
        />
        <OverviewStat
          label={t("app:overview.shipments.createdToday")}
          icon={PackagePlus}
          value={data?.created.current}
          change={data && changeOf(data.created)}
          changeLabel={t("app:overview.shipments.vsYesterday")}
          description={data && t("app:overview.shipments.yesterday", { count: data.created.previous })}
          {...state}
        />
        {/* Not a link: the list can't filter by day, so it would show every delivered shipment. */}
        <OverviewStat
          label={t("app:overview.shipments.deliveredToday")}
          icon={CircleCheck}
          value={data?.delivered.current}
          change={data && changeOf(data.delivered)}
          changeLabel={t("app:overview.shipments.vsYesterday")}
          description={data && t("app:overview.shipments.yesterday", { count: data.delivered.previous })}
          {...state}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownCard byStatus={data?.byStatus} {...state} />
        <ActivityCard activity={data?.recentActivity} {...state} />
      </div>
    </section>
  );
}

/** "Pending sourcing: 3", one link per status, each to the list filtered to it. */
function StatusLinks({ states, byStatus }: { states: CountedState[]; byStatus: ByStatus }) {
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
          {t("app:overview.shipments.statusCount", { status: t(`status.${state}`), count: byStatus[state] })}
        </Link>
      ))}
    </span>
  );
}

type BreakdownProps = { byStatus: ByStatus | undefined; isLoading: boolean; error: unknown; onRetry: () => void };

function BreakdownCard({ byStatus, isLoading, error, onRetry }: BreakdownProps) {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  const total = sumOf(byStatus, COUNTED_STATES);

  return (
    <Card className="gap-4 p-5" aria-busy={isLoading || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-heading-16">{t("app:overview.shipments.byStatus")}</h3>
        {total !== undefined && !isLoading && (
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
      ) : error || !byStatus ? (
        <CardError onRetry={onRetry} />
      ) : (
        <ShipmentStateBreakdown
          label={t("app:overview.shipments.byStatus")}
          items={COUNTED_STATES.map((state) => ({
            state,
            count: byStatus[state],
            href: withBranch(statusPath(state)),
          }))}
        />
      )}
    </Card>
  );
}
