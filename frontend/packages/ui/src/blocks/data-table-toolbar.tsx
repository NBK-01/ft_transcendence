import type { Column, ReactTable, RowData } from "@tanstack/react-table";
import { ListFilter, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { DataTableFeatures } from "@trans/ui/blocks/data-table";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { Input } from "@trans/ui/components/input";

export type DataTableSearch = {
  /** Column id the search box filters (case-insensitive "contains"). */
  column: string;
  placeholder?: string;
};

export type DataTableFilter = {
  /** Column id to filter. Its values must match the option values. */
  column: string;
  title: string;
  options: { value: string; label: string; icon?: ReactNode }[];
};

export type DataTableSelectionActions<TData> = (rows: TData[], clearSelection: () => void) => ReactNode;

/** Search box, filter menus and, while rows are selected, the page's bulk actions. */
export function DataTableToolbar<TData extends RowData>({
  table,
  search,
  filters,
  selectionActions,
}: {
  table: ReactTable<DataTableFeatures, TData>;
  search?: DataTableSearch;
  filters?: DataTableFilter[];
  selectionActions?: DataTableSelectionActions<TData>;
}) {
  const { t } = useTranslation("common");

  const searchColumn = search ? table.getColumn(search.column) : undefined;
  const isFiltered = table.state.columnFilters.length > 0;
  const selectedRows = table.getSelectedRowModel().rows;
  const searchLabel = search?.placeholder ?? t("table.search");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchColumn && (
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-700"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={(searchColumn.getFilterValue() as string | undefined) ?? ""}
            onChange={(event) => searchColumn.setFilterValue(event.target.value)}
            placeholder={searchLabel}
            aria-label={searchLabel}
            className="h-8 ps-8 text-copy-13"
          />
        </div>
      )}

      {filters?.map((filter) => {
        const column = table.getColumn(filter.column);
        return column ? <FacetedFilter key={filter.column} column={column} filter={filter} /> : null;
      })}

      {isFiltered && (
        <Button variant="tertiary" size="sm" suffix={<X aria-hidden="true" />} onClick={() => table.resetColumnFilters()}>
          {t("table.clearFilters")}
        </Button>
      )}

      {selectionActions && selectedRows.length > 0 && (
        <div className="ms-auto flex items-center gap-2">
          {selectionActions(
            selectedRows.map((row) => row.original),
            () => table.resetRowSelection(),
          )}
        </div>
      )}
    </div>
  );
}

/** Multi-select menu with a count per option, based on the other active filters. */
function FacetedFilter<TData extends RowData>({
  column,
  filter,
}: {
  column: Column<DataTableFeatures, TData>;
  filter: DataTableFilter;
}) {
  const { t } = useTranslation("common");
  const counts = column.getFacetedUniqueValues();
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? []);

  const toggle = (value: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(value);
    else next.delete(value);
    column.setFilterValue(next.size > 0 ? [...next] : undefined);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" prefix={<ListFilter aria-hidden="true" />} className="border-dashed">
          {filter.title}
          {selected.size > 0 && (
            <Badge variant="gray" size="sm" className="tabular-nums">
              {selected.size}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {filter.options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selected.has(option.value)}
            onCheckedChange={(checked) => toggle(option.value, checked)}
            // Keep the menu open so several options can be picked in a row.
            onSelect={(event) => event.preventDefault()}
          >
            {option.icon}
            <span className="flex-1">{option.label}</span>
            <span className="ms-4 text-label-mono-12 text-gray-700 tabular-nums">{counts.get(option.value) ?? 0}</span>
          </DropdownMenuCheckboxItem>
        ))}
        {selected.size > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="justify-center" onSelect={() => column.setFilterValue(undefined)}>
              {t("table.clearFilters")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
