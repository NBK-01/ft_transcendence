import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { isShipmentState, type ShipmentState } from "@trans/ui/blocks/shipment-state";

/** "3" → 3. Anything else (missing, "0", "-2", "abc", "1.5") → page 1. */
const parsePage = (value: string | null) => {
  const page = Number(value);
  return Number.isInteger(page) && page >= 1 ? page : 1;
};

/**
 * Search, status filter and page, stored in the URL (?q=…&status=…&page=…) so
 * a filtered list survives reloads, can be shared as a link, and works with Back.
 * Unknown values (e.g. ?status=foo, ?page=abc) are ignored rather than sent to the API.
 */
export function useShipmentFilters() {
  const [params, setParams] = useSearchParams();

  const q = params.get("q")?.trim() ?? "";
  const rawStatus = params.get("status");
  const status = isShipmentState(rawStatus) ? rawStatus : undefined;
  const page = parsePage(params.get("page"));

  /** Change the search and/or status. Always back to page 1: the old page may not exist in the new results. */
  const update = useCallback(
    (next: { q?: string; status?: ShipmentState | null }) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (next.q !== undefined) {
            const value = next.q.trim();
            if (value) updated.set("q", value);
            else updated.delete("q");
          }
          if (next.status !== undefined) {
            if (next.status) updated.set("status", next.status);
            else updated.delete("status");
          }
          updated.delete("page");
          return updated;
        },
        // Typing shouldn't add a history entry per keystroke.
        { replace: next.status === undefined },
      );
    },
    [setParams],
  );

  /** Go to a page. Each page is a Back step, unless `replace` (used to correct an out-of-range page). */
  const setPage = useCallback(
    (nextPage: number, { replace = false } = {}) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (nextPage > 1) updated.set("page", String(nextPage));
          else updated.delete("page");
          return updated;
        },
        { replace },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => update({ q: "", status: null }), [update]);

  return { q, status, page, isFiltered: Boolean(q || status), update, setPage, clear };
}
