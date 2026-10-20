import {
  columnFacetingFeature,
  columnFilteringFeature,
  createColumnHelper,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type FilterFn,
  type Row,
  type RowData,
  type Table as CoreTable,
} from "@tanstack/react-table";
import { CircleAlert, Lock } from "lucide-react";
import { useMemo, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { DataTablePagination } from "@trans/ui/blocks/data-table-pagination";
import {
  DataTableToolbar,
  type DataTableFilter,
  type DataTableSearch,
  type DataTableSelectionActions,
} from "@trans/ui/blocks/data-table-toolbar";
import { Button } from "@trans/ui/components/button";
import { Checkbox } from "@trans/ui/components/checkbox";
import { Skeleton } from "@trans/ui/components/skeleton";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@trans/ui/components/table";
import { cn } from "@trans/ui/lib/utils";

export type DataTableColumnMeta = {
  /** Numbers and dates read better right-aligned (`end` flips in RTL). */
  align?: "start" | "end";
  className?: string;
};

/**
 * One feature registry for every DataTable, at module scope so it stays
 * stable. TanStack Table v9 only exposes the APIs registered here.
 */
export const dataTableFeatures = tableFeatures({
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  columnFacetingFeature,
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, datetime: sortFn_datetime },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  rowSelectionFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each column keeps its own value type
export type DataTableColumnDef<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>;

/** Typed column helper: `const column = createDataTableColumnHelper<User>()`. */
export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/**
 * Default filter for every column: a list of values (filter menus) keeps rows
 * whose value is in the list; text (search box) is a case-insensitive "contains".
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- shared by every row type
const matchFilter: FilterFn<DataTableFeatures, any> = (row, columnId, filterValue) => {
  const value = row.getValue(columnId);
  if (Array.isArray(filterValue)) return filterValue.includes(value);
  return String(value ?? "")
    .toLowerCase()
    .includes(String(filterValue).trim().toLowerCase());
};
matchFilter.autoRemove = (value) =>
  value == null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);

const DEFAULT_COLUMN = { filterFn: matchFilter };

/** Stable fallback, so `data={query.data}` doesn't rebuild the rows on every render. */
const NO_ROWS: never[] = [];

function SelectAllCheckbox<TData extends RowData>({ table }: { table: CoreTable<DataTableFeatures, TData> }) {
  const { t } = useTranslation("common");
  return (
    <Checkbox
      aria-label={t("table.selectAll")}
      checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
      onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
    />
  );
}

function SelectRowCheckbox<TData extends RowData>({ row }: { row: Row<DataTableFeatures, TData> }) {
  const { t } = useTranslation("common");
  const selected = row.getIsSelected();
  // The selection handler reads `target.checked` and `shiftKey` (Shift+click selects a range).
  const onClick = (event: MouseEvent) =>
    row.getToggleSelectedHandler()({ target: { checked: !selected }, shiftKey: event.shiftKey });
  return (
    <Checkbox aria-label={t("table.selectRow")} checked={selected} disabled={!row.getCanSelect()} onClick={onClick} />
  );
}

function selectColumn<TData extends RowData>(): DataTableColumnDef<TData> {
  return {
    id: "select",
    header: ({ table }) => <SelectAllCheckbox table={table} />,
    cell: ({ row }) => <SelectRowCheckbox row={row} />,
    enableSorting: false,
    enableColumnFilter: false,
  };
}

const isRangeEvent = (event: unknown) => Boolean((event as { shiftKey?: boolean }).shiftKey);

const SKELETON_ROWS = 5;

export type DataTableProps<TData extends RowData> = {
  /** Define these outside the component (or memoize them); a new array resets the table. */
  columns: DataTableColumnDef<TData>[];
  /** `undefined` while the first request is in flight. */
  data: TData[] | undefined;
  getRowId?: (row: TData) => string;
  isLoading?: boolean;
  /** A 403 (anything with `status: 403`, like the API's errors) shows "no access" without a retry button. */
  error?: unknown;
  onRetry?: () => void;
  /** Shown instead of the table when there's no data at all. */
  emptyState?: ReactNode;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  search?: DataTableSearch;
  filters?: DataTableFilter[];
  /** Adds a checkbox column. Pass `getRowId` too, so selection survives sorting and refetches. */
  enableRowSelection?: boolean;
  /** Bulk actions, shown in the toolbar while rows are selected. */
  selectionActions?: DataTableSelectionActions<TData>;
  className?: string;
};

/**
 * Sortable, filterable, paginated table on TanStack Table v9. Rows are
 * processed in the browser; switch to the `manual*` options once the API paginates.
 */
export function DataTable<TData extends RowData>({
  columns,
  data,
  getRowId,
  isLoading = false,
  error,
  onRetry,
  emptyState,
  pageSizeOptions = [10, 20, 50],
  initialPageSize = pageSizeOptions[0] ?? 10,
  search,
  filters,
  enableRowSelection = false,
  selectionActions,
  className,
}: DataTableProps<TData>) {
  const { t } = useTranslation("common");

  const allColumns = useMemo(
    () => (enableRowSelection ? [selectColumn<TData>(), ...columns] : columns),
    [columns, enableRowSelection],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns: allColumns,
    data: data ?? NO_ROWS,
    defaultColumn: DEFAULT_COLUMN,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    enableRowSelection,
    isRowRangeSelectionEvent: isRangeEvent,
    initialState: { pagination: { pageIndex: 0, pageSize: initialPageSize } },
  });

  const showToolbar = Boolean(search || filters?.length || selectionActions);

  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;
  const hasError = Boolean(error) && !isLoading;
  // Retrying won't help: the account's role doesn't include this list.
  const forbidden = hasError && (error as { status?: unknown }).status === 403;
  const isEmpty = !isLoading && !hasError && (data?.length ?? 0) === 0;

  if (isEmpty && emptyState) return <div className={className}>{emptyState}</div>;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showToolbar && (
        <DataTableToolbar table={table} search={search} filters={filters} selectionActions={selectionActions} />
      )}
      <Table aria-busy={isLoading || undefined}>
        {isLoading && <TableCaption className="sr-only">{t("table.loading")}</TableCaption>}
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const meta = header.column.columnDef.meta;
                return (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    aria-sort={
                      header.column.getCanSort()
                        ? sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : "none"
                        : undefined
                    }
                    className={cn(meta?.align === "end" && "text-end", meta?.className)}
                  >
                    {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: Math.min(initialPageSize, SKELETON_ROWS) }, (_, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                {Array.from({ length: columnCount }, (_, cell) => (
                  <TableCell key={cell}>
                    <Skeleton className="h-4 w-full max-w-32" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : hasError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="h-48 text-center whitespace-normal">
                <div role="alert" className="flex flex-col items-center gap-3">
                  {forbidden ? (
                    <Lock className="size-5 text-gray-900" aria-hidden="true" />
                  ) : (
                    <CircleAlert className="size-5 text-red-700" aria-hidden="true" />
                  )}
                  <div className="flex flex-col gap-1">
                    <p className="text-label-14">{t(forbidden ? "table.forbiddenTitle" : "table.errorTitle")}</p>
                    <p className="text-copy-13 text-gray-900">{t(forbidden ? "table.forbiddenBody" : "table.errorBody")}</p>
                  </div>
                  {onRetry && !forbidden && (
                    <Button variant="secondary" size="sm" onClick={onRetry}>
                      {t("table.retry")}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columnCount} className="h-32 text-center text-gray-900">
                {t("table.noResults")}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                {row.getAllCells().map((cell) => {
                  const meta = cell.column.columnDef.meta;
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(meta?.align === "end" && "text-end tabular-nums", meta?.className)}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      {!isLoading && !hasError && rows.length > 0 && (
        <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
      )}
    </div>
  );
}
