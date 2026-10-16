import { ArrowLeft, PackageX, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { isApiError } from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { StatusBadge } from "@trans/ui/blocks/status";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";

import { useShipment } from "../features/shipments/api";
import { CopyButton } from "../features/shipments/copy-button";
import type { Shipment } from "../features/shipments/types";

/** /app/shipment/:id — `id` is the tracking ID. */
export function ShipmentDetailPage() {
  const { t } = useTranslation(["common", "app"]);
  const { id = "" } = useParams();
  const { data, isPending, isError, error, refetch, isFetching } = useShipment(id);

  const notFound = isError && isApiError(error) && error.status === 404;

  return (
    <div className="flex flex-col gap-8">
      <title>{`${data?.trackingId ?? id} · ${t("brand.name")}`}</title>

      <Link
        to="/app"
        className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-md text-label-14 text-gray-900 hover:text-gray-1000"
      >
        <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
        {t("app:shipments.backToList")}
      </Link>

      {isPending ? (
        <ShipmentHeaderSkeleton />
      ) : notFound ? (
        <EmptyState
          icon={PackageX}
          title={t("app:shipments.notFoundTitle")}
          description={t("app:shipments.notFoundBody", { id })}
          action={
            <Button variant="secondary" asChild>
              <Link to="/app">{t("app:shipments.backToList")}</Link>
            </Button>
          }
        />
      ) : isError ? (
        <EmptyState
          icon={TriangleAlert}
          title={t("app:shipments.detailErrorTitle")}
          description={t("app:shipments.errorBody")}
          action={
            <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
              {t("app:shipments.retry")}
            </Button>
          }
        />
      ) : (
        <ShipmentHeader shipment={data} />
      )}
    </div>
  );
}

/** Same frame as the shared PageHeader, but the title is a mono tracking ID with a copy button. */
function ShipmentHeader({ shipment }: { shipment: Shipment }) {
  const { t } = useTranslation("app");
  return (
    <header className="flex flex-col gap-4 border-b border-gray-alpha-400 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-label-mono-12 text-gray-900 uppercase">{t("shipments.eyebrow")}</p>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-mono text-heading-32">{shipment.trackingId}</h1>
          <CopyButton value={shipment.trackingId} label={t("shipments.copyTrackingId")} />
        </div>
      </div>
      <StatusBadge status={shipment.status} size="lg" className="w-fit" />
    </header>
  );
}

function ShipmentHeaderSkeleton() {
  return (
    <div
      aria-busy="true"
      className="flex flex-col gap-4 border-b border-gray-alpha-400 pb-6 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-64" />
      </div>
      <Skeleton className="h-7 w-32" />
    </div>
  );
}
