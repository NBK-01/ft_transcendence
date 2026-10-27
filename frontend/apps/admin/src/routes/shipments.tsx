import { Building2, Info, Package } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useAdminShipments, useStaffAccess } from "@trans/api";
import { DataTable } from "@trans/ui/blocks/data-table";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { PageHeader } from "@trans/ui/blocks/page-header";
import { ShipmentStateDot } from "@trans/ui/blocks/shipment-state";

import { useBranchFilter } from "../features/branches/use-branch-filter";
import { useShipmentColumns } from "../features/shipments/columns";
import {
  PAGE_SIZE,
  SEARCH_COLUMN,
  SEARCH_MAX_LENGTH,
  STATUS_COLUMN,
  STATUS_OPTIONS,
  useShipmentFilters,
} from "../features/shipments/use-shipment-filters";

/**
 * /shipments: every client's shipments, most recently updated first
 * ("shipments:read:all"), or for a dispatcher their branch's only
 * ("shipments:read:org"; the API scopes it). The API searches, filters and
 * pages; the URL holds what's asked for, so the overview can link to one status.
 */
export function ShipmentsPage() {
  const { t } = useTranslation(["common", "app"]);
  const { branchId, locked } = useBranchFilter();
  const { organization } = useStaffAccess();
  const { q, status, page, tableState, setTableState, replacePage } = useShipmentFilters();
  const shipments = useAdminShipments({ q, status, organizationId: branchId ?? undefined, page, limit: PAGE_SIZE });
  const columns = useShipmentColumns();

  // ?page=9 with only 2 pages (an old link, or the list shrank): go to the last page, without
  // a Back step. Until then, the skeleton, not an empty page.
  const lastPage = shipments.data?.meta.totalPages ?? 1;
  const pastLastPage = !shipments.isPlaceholderData && (shipments.data?.meta.totalItems ?? 0) > 0 && page > lastPage;
  useEffect(() => {
    if (pastLastPage) replacePage(lastPage);
  }, [pastLastPage, lastPage, replacePage]);

  const filters = useMemo(
    () => [
      {
        column: STATUS_COLUMN,
        title: t("app:shipments.list.columns.status"),
        // The API takes one status at a time.
        single: true,
        options: STATUS_OPTIONS.map((state) => ({
          value: state,
          label: t(`status.${state}`),
          icon: <ShipmentStateDot status={state} />,
        })),
      },
    ],
    [t],
  );

  const title = <title>{`${t("nav.shipments")} · ${t("brand.name")}`}</title>;
  if (locked && organization === null) {
    return (
      <div className="flex flex-col gap-8">
        {title}
        <PageHeader title={t("nav.shipments")} />
        <EmptyState
          icon={Building2}
          title={t("app:shipments.list.noBranchTitle")}
          description={t("app:shipments.list.noBranchBody")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {title}
      <PageHeader
        title={t("nav.shipments")}
        description={
          locked && organization
            ? t("app:pages.shipmentsScoped", { branch: organization.name })
            : t("app:pages.shipments")
        }
      />
      <div className="flex flex-col gap-3">
        {/* Only partner-created shipments have a branch: say why customer orders drop out of the list. */}
        {branchId && (
          <p className="flex items-start gap-2 text-copy-13 text-gray-900">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {t("app:shipments.list.branchOnly")}
          </p>
        )}
        <DataTable
          columns={columns}
          data={shipments.data?.items}
          getRowId={(shipment) => shipment.trackingId}
          isLoading={shipments.isPending || pastLastPage}
          error={shipments.error}
          onRetry={() => void shipments.refetch()}
          search={{
            column: SEARCH_COLUMN,
            placeholder: t("app:shipments.list.search"),
            maxLength: SEARCH_MAX_LENGTH,
          }}
          filters={filters}
          emptyState={
            <EmptyState
              icon={Package}
              title={t(branchId ? "app:shipments.list.emptyBranchTitle" : "app:shipments.list.emptyTitle")}
              description={t(branchId ? "app:shipments.list.emptyBranchBody" : "app:shipments.list.emptyBody")}
            />
          }
          pageSizeOptions={[PAGE_SIZE]}
          server={{
            state: tableState,
            onStateChange: setTableState,
            rowCount: shipments.data?.meta.totalItems,
            // The previous page, shown while the next one loads (not a background refetch).
            isFetching: shipments.isPlaceholderData,
          }}
        />
      </div>
    </div>
  );
}
