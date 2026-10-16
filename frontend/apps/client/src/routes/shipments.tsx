import { ArrowRight, Package, Plus, SearchX, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { Button } from "@trans/ui/components/button";
import { Card } from "@trans/ui/components/card";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useShipments } from "../features/shipments/api";
import { formatAbsolute, formatRelative } from "../features/shipments/format-time";
import { ShipmentFilters } from "../features/shipments/shipment-filters";
import { ShipmentStateBadge } from "../features/shipments/state-badge";
import type { Shipment } from "../features/shipments/types";
import { useShipmentFilters } from "../features/shipments/use-shipment-filters";

/** Row on md+, stacked card on phones. Columns: tracking ID, route, status, last update. */
const ROW = "grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[10rem_1fr_11rem_8rem] md:items-center";

export function ShipmentsPage() {
  const { t } = useTranslation(["common", "app"]);
  const { q, status, isFiltered, clear } = useShipmentFilters();
  const { data, isPending, isError, refetch, isFetching, isPlaceholderData } = useShipments({ q, status });
  // The empty state has its own big New shipment button; don't show two.
  const isEmpty = !isPending && !isError && data.items.length === 0 && !isFiltered;

  return (
    <div className="flex flex-col gap-8">
      <title>{`${t("nav.shipments")} · ${t("brand.name")}`}</title>
      <PageHeader
        title={t("nav.shipments")}
        description={t("app:pages.shipments")}
        actions={isEmpty ? undefined : <NewShipmentButton />}
      />
      <ShipmentFilters />

      {isPending ? (
        <ShipmentListSkeleton />
      ) : isError ? (
        <EmptyState
          icon={TriangleAlert}
          title={t("app:shipments.errorTitle")}
          description={t("app:shipments.errorBody")}
          action={
            <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
              {t("app:shipments.retry")}
            </Button>
          }
        />
      ) : data.items.length === 0 && isFiltered ? (
        <EmptyState
          icon={SearchX}
          title={t("app:shipments.noMatchTitle")}
          description={t("app:shipments.noMatchBody")}
          action={
            <Button variant="secondary" onClick={clear}>
              {t("app:shipments.clearFilters")}
            </Button>
          }
        />
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("app:shipments.emptyTitle")}
          description={t("app:shipments.emptyBody")}
          action={<NewShipmentButton />}
        />
      ) : (
        // Previous results stay visible (dimmed) while the new filter loads.
        <ShipmentList shipments={data.items} stale={isPlaceholderData} />
      )}
    </div>
  );
}

function NewShipmentButton() {
  const { t } = useTranslation("app");
  return (
    <Button variant="accent" asChild>
      <Link to="/app/shipment/new">
        <Plus aria-hidden="true" />
        {t("shipments.newShipment")}
      </Link>
    </Button>
  );
}

function ColumnHeaders() {
  const { t } = useTranslation("app");
  return (
    <div
      aria-hidden="true"
      className={`${ROW} hidden border-b border-gray-alpha-400 bg-background-200 py-2 text-label-12 text-gray-900 md:grid`}
    >
      <span>{t("shipments.columns.trackingId")}</span>
      <span>{t("shipments.columns.route")}</span>
      <span>{t("shipments.columns.status")}</span>
      <span className="text-end">{t("shipments.columns.updatedAt")}</span>
    </div>
  );
}

function ShipmentList({ shipments, stale }: { shipments: Shipment[]; stale: boolean }) {
  const { t } = useTranslation("app");
  return (
    <Card
      aria-busy={stale}
      className={`overflow-hidden transition-opacity duration-150 ${stale ? "opacity-60" : ""}`}
    >
      <ColumnHeaders />
      <ul aria-label={t("shipments.listLabel")} className="divide-y divide-gray-alpha-400">
        {shipments.map((shipment) => (
          <ShipmentRow key={shipment.trackingId} shipment={shipment} />
        ))}
      </ul>
    </Card>
  );
}

function ShipmentRow({ shipment }: { shipment: Shipment }) {
  const { t, i18n } = useTranslation("app");
  return (
    <li>
      <Link
        to={`/app/shipment/${encodeURIComponent(shipment.trackingId)}`}
        className={`${ROW} focus-ring transition-colors hover:bg-gray-alpha-100`}
      >
        <span className="text-label-mono-14 text-gray-1000">{shipment.trackingId}</span>

        <span className="order-last flex min-w-0 items-center gap-2 text-copy-14 md:order-none">
          <span className="sr-only">{t("shipments.columns.route")}: </span>
          {shipment.origin && shipment.destination ? (
            <>
              <span className="truncate">{shipment.origin}</span>
              <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-gray-900 rtl:rotate-180" />
              <span className="truncate">{shipment.destination}</span>
            </>
          ) : (
            <span className="truncate text-gray-900">{t("shipments.routeUnknown")}</span>
          )}
        </span>

        <span className="justify-self-end md:justify-self-start">
          <ShipmentStateBadge status={shipment.status} size="sm" />
        </span>

        <time
          dateTime={shipment.updatedAt}
          title={formatAbsolute(shipment.updatedAt, i18n.language)}
          className="order-last text-end text-copy-13 text-gray-900 md:order-none"
        >
          {formatRelative(shipment.updatedAt, i18n.language)}
        </time>
      </Link>
    </li>
  );
}

function ShipmentListSkeleton() {
  return (
    <Card className="overflow-hidden" aria-busy="true">
      <ColumnHeaders />
      <ul className="divide-y divide-gray-alpha-400">
        {Array.from({ length: 5 }, (_, index) => (
          <li key={index} className={ROW}>
            <Skeleton className="h-4 w-28" />
            <Skeleton className="order-last h-4 w-40 md:order-none" />
            <Skeleton className="h-5 w-24 justify-self-end md:justify-self-start" />
            <Skeleton className="order-last h-4 w-16 justify-self-end md:order-none" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
