import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { AdminShipment } from "@trans/api";
import { createDataTableColumnHelper } from "@trans/ui/blocks/data-table";
import { DataTableColumnHeader } from "@trans/ui/blocks/data-table-column-header";
import { ShipmentStateBadge } from "@trans/ui/blocks/shipment-state";

import { useBranchFilter } from "../branches/use-branch-filter";
import { LastUpdate } from "./last-update";
import { ShipmentRoute } from "./shipment-route";

const column = createDataTableColumnHelper<AdminShipment>();

/**
 * The shipments table: tracking ID (to the detail page), customer, branch,
 * route, status and dates. The API orders and sorts the rows — tracking ID,
 * status and the two dates are sortable (ShipmentSortField on the backend);
 * customer/branch/route are derived/joined, so they stay plain labels.
 * Rebuilt when the language changes, so labels and dates follow.
 */
export function useShipmentColumns() {
  const { t, i18n } = useTranslation(["common", "app"]);
  const { withBranch } = useBranchFilter();

  return useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(`${i18n.language}-u-nu-latn`, { dateStyle: "medium" });
    return column.columns([
      column.accessor("trackingId", {
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:shipments.list.columns.trackingId")} />,
        cell: (info) => (
          <Link
            to={withBranch(`/shipments/${encodeURIComponent(info.getValue())}`)}
            dir="ltr"
            className="focus-ring rounded-sm text-label-mono-14 text-gray-1000 hover:underline"
          >
            {info.getValue()}
          </Link>
        ),
      }),
      column.display({
        id: "customer",
        header: t("app:shipments.list.columns.customer"),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-label-14 text-gray-1000">{row.original.client.name}</span>
            <span className="truncate text-copy-13 text-gray-900" dir="ltr">
              {row.original.client.email}
            </span>
          </div>
        ),
      }),
      column.display({
        id: "branch",
        header: t("app:shipments.list.columns.branch"),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.organization ? (
            <Link
              to={withBranch(`/branches/${encodeURIComponent(row.original.organization.id)}`)}
              className="focus-ring rounded-sm text-label-14 text-gray-1000 hover:underline"
            >
              <bdi>{row.original.organization.name}</bdi>
            </Link>
          ) : (
            <span className="text-copy-14 text-gray-900">{t("app:shipments.list.noBranch")}</span>
          ),
      }),
      column.display({
        id: "route",
        enableSorting: false,
        header: t("app:shipments.list.columns.route"),
        cell: ({ row }) => <ShipmentRoute origin={row.original.origin} destination={row.original.destination} />,
      }),
      column.accessor("status", {
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("app:shipments.list.columns.status")} />,
        cell: (info) => <ShipmentStateBadge status={info.getValue()} size="sm" />,
      }),
      column.accessor("createdAt", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("app:shipments.list.columns.created")} />
        ),
        cell: (info) => dateFormat.format(new Date(info.getValue())),
        meta: { align: "end" },
      }),
      column.accessor("updatedAt", {
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("app:shipments.list.columns.updatedAt")} />
        ),
        cell: (info) => <LastUpdate at={info.getValue()} />,
        meta: { align: "end" },
      }),
    ]);
  }, [t, i18n.language, withBranch]);
}
