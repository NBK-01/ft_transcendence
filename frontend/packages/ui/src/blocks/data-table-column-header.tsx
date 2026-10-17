import type { Column, RowData } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import type { DataTableFeatures } from "@trans/ui/blocks/data-table";
import { Button } from "@trans/ui/components/button";
import { cn } from "@trans/ui/lib/utils";

/**
 * Header label that toggles sorting. Use it as a column's `header`:
 * `header: ({ column }) => <DataTableColumnHeader column={column} title={t("…")} />`.
 * The DataTable sets `aria-sort` on the cell, so screen readers hear the order.
 */
export function DataTableColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) return <span className={className}>{title}</span>;

  const sorted = column.getIsSorted();
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  const alignEnd = column.columnDef.meta?.align === "end";

  return (
    <Button
      variant="tertiary"
      size="sm"
      data-sorted={sorted || undefined}
      onClick={column.getToggleSortingHandler()}
      suffix={<Icon className={cn(!sorted && "text-gray-700")} aria-hidden="true" />}
      className={cn(
        "h-7 gap-1 px-2 text-label-13 text-gray-900 data-sorted:text-gray-1000",
        alignEnd ? "-me-2" : "-ms-2",
        className,
      )}
    >
      {title}
    </Button>
  );
}
