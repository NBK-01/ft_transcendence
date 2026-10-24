import type { ReactTable, RowData } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import type { DataTableFeatures } from "@trans/ui/blocks/data-table";
import { Button } from "@trans/ui/components/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@trans/ui/components/select";

/** Row range, page size and previous/next. The chevrons mirror in RTL. */
export function DataTablePagination<TData extends RowData>({
  table,
  pageSizeOptions,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  pageSizeOptions: number[];
}) {
  const { t } = useTranslation("common");
  const labelId = useId();

  const { pageIndex, pageSize } = table.state.pagination;
  const total = table.getRowCount();
  const from = total === 0 ? 0 : pageIndex * pageSize + 1;
  const to = Math.min((pageIndex + 1) * pageSize, total);
  const selected = table.getSelectedRowIds().length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1 text-copy-13 text-gray-900">
      <p className="tabular-nums" aria-live="polite">
        {selected > 0
          ? t("table.selected", { selected, total: table.getCoreRowModel().rows.length })
          : t("table.range", { from, to, total })}
      </p>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {/* A fixed page size (one option) has nothing to pick. */}
        {pageSizeOptions.length > 1 && (
          <div className="flex items-center gap-2">
            <span id={labelId}>{t("table.rowsPerPage")}</span>
            <Select value={String(pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
              <SelectTrigger size="sm" aria-labelledby={labelId} className="w-18 tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)} className="tabular-nums">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="tabular-nums">
            {t("table.page", { page: pageIndex + 1, total: Math.max(table.getPageCount(), 1) })}
          </span>
          <Button
            variant="secondary"
            size="sm"
            shape="square"
            aria-label={t("table.previousPage")}
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft className="rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            shape="square"
            aria-label={t("table.nextPage")}
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight className="rtl:rotate-180" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
