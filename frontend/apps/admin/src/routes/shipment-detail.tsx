import { ArrowLeft, PackageX } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";

import { isApiError, isForbidden, useAdminShipment, useStaffAccess, type AdminShipmentDetail } from "@trans/api";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@trans/ui/components/breadcrumb";
import { Button } from "@trans/ui/components/button";
import { Skeleton } from "@trans/ui/components/skeleton";

import { NoAccess } from "../features/auth/require-admin";
import { useBranchFilter } from "../features/branches/use-branch-filter";
import { DeliverySection } from "../features/shipments/delivery-details";
import { FilesSection } from "../features/shipments/files-section";
import { NextStep } from "../features/shipments/next-step";
import { OfferSection, PaymentSection, RequestSection } from "../features/shipments/order-details";
import { ShipmentHeader } from "../features/shipments/shipment-header";
import { TimelineSection } from "../features/shipments/timeline-section";

/** /shipments/:trackingId: one shipment, from the request to its delivery (needs "shipments:read:all"). */
export function ShipmentDetailPage() {
  const { trackingId: param = "" } = useParams();
  // Tracking IDs are upper case; the API finds them typed in any case. One cache entry for both.
  const trackingId = param.trim().toUpperCase();
  const shipment = useAdminShipment(trackingId);

  if (!trackingId) return <LoadProblem notFound />;
  if (shipment.isPending) return <DetailSkeleton />;
  if (shipment.isError) {
    // The page checks the role signed in with; a role changed since then gets a 403 here.
    if (isForbidden(shipment.error)) return <NoAccess />;
    return (
      <LoadProblem
        // 3001: no shipment with that tracking ID.
        notFound={isApiError(shipment.error) && shipment.error.status === 404}
        onRetry={() => void shipment.refetch()}
        retrying={shipment.isFetching}
      />
    );
  }
  return <ShipmentDetail shipment={shipment.data} />;
}

/**
 * What to do next under the header, then the order details on the main side,
 * in the order they're filled in, and the history and files on the end side.
 * One column below xl, where the side would be too narrow.
 */
function ShipmentDetail({ shipment }: { shipment: AdminShipmentDetail }) {
  const { t } = useTranslation("common");
  const canDeletePhotos = useStaffAccess().can("shipments:update:org") && shipment.status === "pending_client_decision";
  return (
    <div className="flex flex-col gap-8">
      <title>{`${shipment.trackingId} · ${t("brand.name")}`}</title>
      <div className="flex flex-col gap-4">
        <ShipmentBreadcrumb trackingId={shipment.trackingId} />
        <ShipmentHeader shipment={shipment} />
      </div>
      <NextStep shipment={shipment} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <RequestSection request={shipment.request} />
          {shipment.offer && (
            <OfferSection offer={shipment.offer} trackingId={shipment.trackingId} canDeletePhotos={canDeletePhotos} />
          )}
          {shipment.payment && <PaymentSection payment={shipment.payment} />}
          <DeliverySection shipment={shipment} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <TimelineSection trackingId={shipment.trackingId} />
          <FilesSection trackingId={shipment.trackingId} />
        </div>
      </div>
    </div>
  );
}

function ShipmentBreadcrumb({ trackingId }: { trackingId: string }) {
  const { t } = useTranslation("common");
  const { withBranch } = useBranchFilter();
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to={withBranch("/shipments")}>{t("nav.shipments")}</Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage className="font-mono">{trackingId}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Not found, or couldn't load: no shipment for a breadcrumb, just the way back. */
function LoadProblem({
  notFound = false,
  onRetry,
  retrying = false,
}: {
  notFound?: boolean;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();
  return (
    <div className="flex flex-col gap-6">
      <Link
        to={withBranch("/shipments")}
        className="focus-ring flex w-fit items-center gap-1.5 rounded-md text-label-14 text-gray-900 hover:text-gray-1000"
      >
        <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        {t("nav.shipments")}
      </Link>
      <EmptyState
        icon={PackageX}
        title={t(notFound ? "app:shipment.notFoundTitle" : "app:shipment.errorTitle")}
        description={t(notFound ? "app:shipment.notFoundBody" : "table.errorBody")}
        action={
          !notFound &&
          onRetry && (
            <Button variant="secondary" loading={retrying} onClick={onRetry}>
              {t("table.retry")}
            </Button>
          )
        }
      />
    </div>
  );
}

/** The page's shape: breadcrumb, header, next step, then the two columns. */
function DetailSkeleton() {
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <span className="sr-only">{t("table.loading")}</span>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-5 w-48" />
        <div className="flex flex-col gap-5 border-b border-gray-alpha-400 pb-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-56 max-w-full" />
            <Skeleton className="h-7 w-28" />
          </div>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <Skeleton className="h-11 w-48" />
            <Skeleton className="h-11 w-36" />
            <Skeleton className="h-11 w-36" />
          </div>
        </div>
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
