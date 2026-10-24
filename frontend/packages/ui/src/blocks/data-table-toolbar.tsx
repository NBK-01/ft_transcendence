import type { Column, ReactTable, RowData } from "@tanstack/react-table";
import { ListFilter, Search, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { DataTableFeatures } from "@trans/ui/blocks/data-table";
import { Badge } from "@trans/ui/components/badge";
import { Button } from "@trans/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trans/ui/components/dropdown-menu";
import { Input } from "@trans/ui/components/input";

export type DataTableSearch = {
  /** Column id the search box filters (case-insensitive "contains"). */
  column: string;
  placeholder?: string;
  /** The API's limit on the search text, so a long paste can't fail the request. */
  maxLength?: number;
};

export type DataTableFilter = {
  /** Column id to filter. Its values must match the option values. */
  column: string;
  title: string;
  options: { value: string; label: string; icon?: ReactNode }[];
  /** One value at a time (an API that takes a single value). The filter value is still a list. */
  single?: boolean;
};

/** In server mode each search is a request, so the box waits for a pause in typing. */
const SEARCH_DELAY_MS = 300;

/**
 * `clearSelection` also moves focus to the search box: the actions disappear
 * with the selection, so focus would otherwise drop to <body>.
 */
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
  const searchId = useId();

  const clearSelection = () => {
    table.resetRowSelection();
    // After the commit and any closing dialog's own focus handling, which would undo an earlier call.
    setTimeout(() => document.getElementById(searchId)?.focus());
  };

  const searchColumn = search ? table.getColumn(search.column) : undefined;
  const isFiltered = table.state.columnFilters.length > 0;
  const selectedRows = table.getSelectedRowModel().rows;
  // Server mode: the API filters, and the rows here are only one page of the results.
  const serverSide = Boolean(table.options.manualFiltering);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {search && searchColumn && (
        <SearchBox id={searchId} column={searchColumn} search={search} delay={serverSide ? SEARCH_DELAY_MS : 0} />
      )}

      {filters?.map((filter) => {
        const column = table.getColumn(filter.column);
        return column ? (
          <FacetedFilter key={filter.column} column={column} filter={filter} showCounts={!serverSide} />
        ) : null;
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
            clearSelection,
          )}
        </div>
      )}
    </div>
  );
}

/** The search box. With a `delay`, it keeps its own text and updates the filter after a pause. */
function SearchBox<TData extends RowData>({
  id,
  column,
  search,
  delay,
}: {
  id: string;
  column: Column<DataTableFeatures, TData>;
  search: DataTableSearch;
  delay: number;
}) {
  const { t } = useTranslation("common");
  const label = search.placeholder ?? t("table.search");
  const value = (column.getFilterValue() as string | undefined) ?? "";
  const [draft, setDraft] = useState(value);

  // The filter changed from outside ("Clear filters", the Back button): show it.
  const [synced, setSynced] = useState(value);
  if (value !== synced) {
    setSynced(value);
    if (draft.trim() !== value.trim()) setDraft(value);
  }

  useEffect(() => {
    if (!delay || draft.trim() === value.trim()) return;
    const timer = setTimeout(() => column.setFilterValue(draft), delay);
    return () => clearTimeout(timer);
  }, [delay, draft, value, column]);

  return (
    <div className="relative w-full sm:w-64">
      <Search
        className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-700"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          if (!delay) column.setFilterValue(event.target.value);
        }}
        placeholder={label}
        aria-label={label}
        maxLength={search.maxLength}
        className="h-8 ps-8 text-copy-13"
      />
    </div>
  );
}

/**
 * Filter menu: several options with a check box each, or one at a time
 * (`single`). Counts are per option, based on the other active filters.
 */
function FacetedFilter<TData extends RowData>({
  column,
  filter,
  showCounts,
}: {
  column: Column<DataTableFeatures, TData>;
  filter: DataTableFilter;
  /** Off in server mode: the browser only has one page to count. */
  showCounts: boolean;
}) {
  const { t } = useTranslation("common");
  const counts = showCounts ? column.getFacetedUniqueValues() : undefined;
  const selected = new Set((column.getFilterValue() as string[] | undefined) ?? []);
  // A single choice reads better by name than as "1".
  const picked = filter.single ? filter.options.find((option) => selected.has(option.value))?.label : undefined;

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
              {picked ?? selected.size}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {filter.single ? (
          <DropdownMenuRadioGroup value={[...selected][0] ?? ""} onValueChange={(value) => column.setFilterValue([value])}>
            {filter.options.map((option) => (
              <DropdownMenuRadioItem key={option.value} value={option.value}>
                {option.icon}
                <span className="flex-1">{option.label}</span>
                {counts && <OptionCount count={counts.get(option.value)} />}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        ) : (
          filter.options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selected.has(option.value)}
              onCheckedChange={(checked) => toggle(option.value, checked)}
              // Keep the menu open so several options can be picked in a row.
              onSelect={(event) => event.preventDefault()}
            >
              {option.icon}
              <span className="flex-1">{option.label}</span>
              {counts && <OptionCount count={counts.get(option.value)} />}
            </DropdownMenuCheckboxItem>
          ))
        )}
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

function OptionCount({ count = 0 }: { count?: number }) {
  return <span className="ms-4 text-label-mono-12 text-gray-700 tabular-nums">{count}</span>;
}
