import type { Meta, StoryObj } from "@storybook/react-vite";
import { Package, Plus, Trash2 } from "lucide-react";

import { createDataTableColumnHelper, DataTable } from "@trans/ui/blocks/data-table";
import { DataTableColumnHeader } from "@trans/ui/blocks/data-table-column-header";
import { EmptyState } from "@trans/ui/blocks/empty-state";
import { SHIPMENT_STATUSES, StatusBadge, StatusDot, type ShipmentStatus } from "@trans/ui/blocks/status";
import { Button } from "@trans/ui/components/button";

type Shipment = {
  id: string;
  trackingId: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  weightKg: number;
  updatedAt: string;
};

const CITIES = ["Amman", "Irbid", "Zarqa", "Aqaba", "Madaba", "Salt", "Jerash", "Karak"];

/** Deterministic sample data, so stories and screenshots don't change between runs. */
const shipments: Shipment[] = Array.from({ length: 42 }, (_, index) => ({
  id: `shp_${index + 1}`,
  trackingId: `TRK-${48250 - index * 7}`,
  origin: CITIES[index % CITIES.length]!,
  destination: CITIES[(index * 3 + 1) % CITIES.length]!,
  status: SHIPMENT_STATUSES[(index * 5) % SHIPMENT_STATUSES.length]!,
  weightKg: Math.round(((index * 37) % 120) * 10 + 15) / 10,
  updatedAt: new Date(Date.UTC(2026, 9, 15, 9) - index * 97 * 60_000).toISOString(),
}));

const column = createDataTableColumnHelper<Shipment>();

const columns = column.columns([
  column.accessor("trackingId", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tracking ID" />,
    cell: (info) => <span className="text-label-mono-13">{info.getValue()}</span>,
  }),
  column.accessor((row) => `${row.origin} → ${row.destination}`, {
    id: "route",
    header: "Route",
    enableSorting: false,
  }),
  column.accessor("status", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: (info) => <StatusBadge status={info.getValue()} size="sm" />,
  }),
  column.accessor("weightKg", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Weight (kg)" />,
    meta: { align: "end" },
  }),
  column.accessor("updatedAt", {
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last update" />,
    cell: (info) =>
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(
        new Date(info.getValue()),
      ),
    sortFn: "datetime",
    sortDescFirst: true,
  }),
]);

const meta = {
  title: "Blocks/Data Table",
  component: DataTable<Shipment>,
  tags: ["autodocs"],
  args: { columns, data: shipments, getRowId: (row: Shipment) => row.id },
  parameters: { layout: "padded" },
  decorators: [(Story) => <div className="mx-auto w-full max-w-5xl">{Story()}</div>],
} satisfies Meta<typeof DataTable<Shipment>>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click a header to sort. The route column opts out of sorting. */
export const Default: Story = {};

export const Loading: Story = { args: { data: undefined, isLoading: true } };

/** No data at all: the page's EmptyState replaces the table. */
export const Empty: Story = {
  args: {
    data: [],
    emptyState: (
      <EmptyState
        icon={Package}
        title="No shipments yet"
        description="Create your first shipment and track it here in real time."
        action={<Button prefix={<Plus />}>New shipment</Button>}
      />
    ),
  },
};

/** Without an `emptyState`, the table shows a "No results" row. */
export const NoResults: Story = { args: { data: [] } };

export const Error: Story = {
  args: { data: undefined, error: new globalThis.Error("Network error"), onRetry: () => {} },
};

export const LargePages: Story = { args: { pageSizeOptions: [20, 50, 100] } };

const STATUS_LABELS: Record<ShipmentStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  in_transit: "In transit",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const statusFilter = {
  column: "status",
  title: "Status",
  options: SHIPMENT_STATUSES.map((status) => ({
    value: status,
    label: STATUS_LABELS[status],
    icon: <StatusDot status={status} />,
  })),
};

/** Search by tracking ID and filter by status. Each option shows how many rows it would match. */
export const Filtered: Story = {
  args: {
    search: { column: "trackingId", placeholder: "Search tracking ID…" },
    filters: [statusFilter],
  },
};

/** Checkbox column, Shift+click to select a range, and bulk actions while rows are selected. */
export const WithSelection: Story = {
  args: {
    search: { column: "trackingId", placeholder: "Search tracking ID…" },
    filters: [statusFilter],
    enableRowSelection: true,
    selectionActions: (rows, clearSelection) => (
      <>
        <Button variant="tertiary" size="sm" onClick={clearSelection}>
          Clear selection
        </Button>
        <Button variant="error" size="sm" prefix={<Trash2 />} onClick={clearSelection}>
          Cancel {rows.length}
        </Button>
      </>
    ),
  },
};
