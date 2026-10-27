import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import type { AdminShipmentSortField } from "@trans/api";
import type { DataTableServerState } from "@trans/ui/blocks/data-table";
import { SHIPMENT_STATES, type ShipmentState } from "@trans/ui/blocks/shipment-state";

/** The backend's default page size. */
export const PAGE_SIZE = 20;
/** The backend's limit on `q`: a longer search is a 400. */
export const SEARCH_MAX_LENGTH = 50;

/** The table columns the search box and the status menu filter. */
export const SEARCH_COLUMN = "trackingId";
export const STATUS_COLUMN = "status";

/** Columns the board can sort by — must match the backend's ShipmentSortField exactly. */
export const SORT_COLUMNS: readonly AdminShipmentSortField[] = ["trackingId", "status", "createdAt", "updatedAt"];
const DEFAULT_SORT: AdminShipmentSortField = "updatedAt";
const DEFAULT_ORDER = "desc";

/**
 * What the status menu offers, in workflow order. `requested` is left out:
 * nothing sets it (a new request starts at pending_sourcing), so it would
 * always be empty.
 */
export const STATUS_OPTIONS: readonly ShipmentState[] = SHIPMENT_STATES.filter((state) => state !== "requested");

/** "3" → 3. Anything else (missing, "0", "-2", "abc", "1.5") → page 1. */
const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

const filterValue = (state: DataTableServerState, column: string) =>
  state.columnFilters.find((filter) => filter.id === column)?.value;

/** Reads `?sort=` back into a sort field, falling back to the default for an unknown/missing value. */
const parseSort = (value: string | null): AdminShipmentSortField =>
  SORT_COLUMNS.find((column) => column === value) ?? DEFAULT_SORT;
const parseOrder = (value: string | null): "asc" | "desc" => (value === "asc" ? "asc" : DEFAULT_ORDER);

/**
 * Search, status, page and sort in the URL (`?q=…&status=…&page=…&sort=…&order=…`,
 * next to `?branch=`), so the list survives a reload, can be shared, and the
 * overview can link to one status. Values the API would reject fall back: an
 * unknown status shows every status, a bad page the first one, a long search
 * is cut, an unknown sort column falls back to the default (most recently updated).
 */
export function useShipmentFilters() {
  const [params, setParams] = useSearchParams();

  const q = (params.get("q") ?? "").trim().slice(0, SEARCH_MAX_LENGTH);
  const status = STATUS_OPTIONS.find((option) => option === params.get("status"));
  const page = parsePage(params.get("page"));
  const sort = parseSort(params.get("sort"));
  const order = parseOrder(params.get("order"));

  /** The same values in the DataTable's terms (page from 0, filters by column, one-column sort). */
  const tableState = useMemo<DataTableServerState>(
    () => ({
      pagination: { pageIndex: page - 1, pageSize: PAGE_SIZE },
      columnFilters: [
        ...(q ? [{ id: SEARCH_COLUMN, value: q }] : []),
        ...(status ? [{ id: STATUS_COLUMN, value: [status] }] : []),
      ],
      sorting: [{ id: sort, desc: order === "desc" }],
    }),
    [q, status, page, sort, order],
  );

  const write = useCallback(
    (next: { q: string; status: string; page: number; sort: string; order: string }, replace: boolean) =>
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          // Empty/default values leave the URL, and so does page 1.
          const set = (key: string, value: string) => (value ? updated.set(key, value) : updated.delete(key));
          set("q", next.q);
          set("status", next.status);
          set("page", next.page > 1 ? String(next.page) : "");
          set("sort", next.sort !== DEFAULT_SORT ? next.sort : "");
          set("order", next.order !== DEFAULT_ORDER ? next.order : "");
          return updated;
        },
        { replace },
      ),
    [setParams],
  );

  /**
   * One URL update per table change. A new search replaces the entry, so Back
   * doesn't step through each pause in typing; a status, page or sort is a Back step.
   */
  const setTableState = useCallback(
    (next: DataTableServerState) => {
      const nextQ = String(filterValue(next, SEARCH_COLUMN) ?? "").trim();
      const nextStatus = (filterValue(next, STATUS_COLUMN) as string[] | undefined)?.[0] ?? "";
      const nextSort = next.sorting?.[0];
      write(
        {
          q: nextQ,
          status: nextStatus,
          page: next.pagination.pageIndex + 1,
          sort: nextSort?.id ?? DEFAULT_SORT,
          order: nextSort ? (nextSort.desc ? "desc" : "asc") : DEFAULT_ORDER,
        },
        nextQ !== q,
      );
    },
    [write, q],
  );

  /** Moves to another page without a Back step, to correct a page past the last one. */
  const replacePage = useCallback(
    (nextPage: number) => write({ q, status: status ?? "", page: nextPage, sort, order }, true),
    [write, q, status, sort, order],
  );

  return { q, status, page, sort, order, tableState, setTableState, replacePage };
}
