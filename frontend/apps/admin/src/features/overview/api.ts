import { queryOptions, useQueries, type UseQueryResult } from "@tanstack/react-query";

import { api, keys, type AdminShipment, type Page } from "@trans/api";
import { SHIPMENT_STATES, type ShipmentState } from "@trans/ui/blocks/shipment-state";

export type CountedState = Exclude<ShipmentState, "requested">;
export type CountQuery = UseQueryResult<Page<AdminShipment>>;

/** The statuses the overview counts, in lifecycle order: all but "requested", which nothing sets. */
export const COUNTED_STATES = SHIPMENT_STATES.filter((state): state is CountedState => state !== "requested");

/** One status's page of one row: only its `meta.totalItems` is used. Same key and data as useAdminShipments. */
const countQuery = (status: CountedState) => {
  const filters = { q: undefined, status, page: 1, limit: 1 };
  return queryOptions({
    queryKey: keys.adminShipments.list(filters),
    queryFn: ({ signal }) => api.getPage<AdminShipment>("/admin/shipments", { query: filters, signal }),
  });
};

/**
 * How many shipments are in each status, from GET /admin/shipments: one small
 * request per status until the backend has a stats endpoint. A status change
 * refreshes every shipments list, so these refresh too. Needs
 * "shipments:read:all" (admin, support): mount it only for those roles.
 */
export function useShipmentCounts() {
  return useQueries({ queries: COUNTED_STATES.map(countQuery), combine: byStatus });
}

/** useQueries keeps the results in the order asked. */
function byStatus(results: CountQuery[]) {
  return Object.fromEntries(COUNTED_STATES.map((status, index) => [status, results[index]])) as Record<
    CountedState,
    CountQuery
  >;
}

/** The sum of some statuses' counts, once they've all loaded. */
export function totalOf(queries: CountQuery[]) {
  if (queries.some((query) => !query.data)) return undefined;
  return queries.reduce((sum, query) => sum + (query.data?.meta.totalItems ?? 0), 0);
}
