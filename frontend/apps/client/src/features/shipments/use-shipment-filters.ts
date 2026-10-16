import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { isShipmentState, type ShipmentState } from "./stages";

/**
 * Search + status filter, stored in the URL (?q=…&status=…) so a filtered
 * list survives reloads, can be shared as a link, and works with Back.
 * Unknown values (e.g. ?status=foo) are ignored rather than sent to the API.
 */
export function useShipmentFilters() {
  const [params, setParams] = useSearchParams();

  const q = params.get("q")?.trim() ?? "";
  const rawStatus = params.get("status");
  const status = isShipmentState(rawStatus) ? rawStatus : undefined;

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
          return updated;
        },
        // Typing shouldn't add a history entry per keystroke.
        { replace: next.status === undefined },
      );
    },
    [setParams],
  );

  const clear = useCallback(() => update({ q: "", status: null }), [update]);

  return { q, status, isFiltered: Boolean(q || status), update, clear };
}
