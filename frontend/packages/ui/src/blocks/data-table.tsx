import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { DataTablePagination } from "@trans/ui/blocks/data-table-pagination";
import { Button } from "@trans/ui/components/button";
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
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, datetime: sortFn_datetime },
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export type DataTableFeatures = typeof dataTableFeatures;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each column keeps its own value type
export type DataTableColumnDef<TData extends RowData> = ColumnDef<DataTableFeatures, TData, any>;

/** Typed column helper: `const column = createDataTableColumnHelper<User>()`. */
export function createDataTableColumnHelper<TData extends RowData>() {
  return createColumnHelper<DataTableFeatures, TData>();
}

/** Stable fallback, so `data={query.data}` doesn't rebuild the rows on every render. */
const NO_ROWS: never[] = [];

const SKELETON_ROWS = 5;

export type DataTableProps<TData extends RowData> = {
  /** Define these outside the component (or memoize them); a new array resets the table. */
  columns: DataTableColumnDef<TData>[];
  /** `undefined` while the first request is in flight. */
  data: TData[] | undefined;
  getRowId?: (row: TData) => string;
  isLoading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Shown instead of the table when there's no data at all. */
  emptyState?: ReactNode;
  pageSizeOptions?: number[];
  initialPageSize?: number;
  className?: string;
};

/**
 * Sortable, paginated table on TanStack Table v9. Rows are processed in the
 * browser; switch to the `manual*` options once the API paginates.
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
  className,
}: DataTableProps<TData>) {
  const { t } = useTranslation("common");

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: data ?? NO_ROWS,
    getRowId: getRowId ? (row) => getRowId(row) : undefined,
    initialState: { pagination: { pageIndex: 0, pageSize: initialPageSize } },
  });

  const rows = table.getRowModel().rows;
  const columnCount = table.getAllLeafColumns().length;
  const hasError = Boolean(error) && !isLoading;
  const isEmpty = !isLoading && !hasError && (data?.length ?? 0) === 0;

  if (isEmpty && emptyState) return <div className={className}>{emptyState}</div>;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
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
                  <CircleAlert className="size-5 text-red-700" aria-hidden="true" />
                  <div className="flex flex-col gap-1">
                    <p className="text-label-14">{t("table.errorTitle")}</p>
                    <p className="text-copy-13 text-gray-900">{t("table.errorBody")}</p>
                  </div>
                  {onRetry && (
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
              <TableRow key={row.id}>
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
