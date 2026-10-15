import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@trans/api";

import type { PaginatedEnvelope, Shipment, ShipmentFilters } from "./types";

/** Query keys for shipments. Client-local until admin needs them too. */
export const shipmentKeys = {
  all: ["shipments"] as const,
  list: (filters: ShipmentFilters) => [...shipmentKeys.all, "list", filters] as const,
};

/** GET /shipments — the caller's shipments, newest update first. */
export function useShipments(filters: ShipmentFilters = {}) {
  const { page = 1, limit = 20 } = filters;
  return useQuery({
    queryKey: shipmentKeys.list({ page, limit }),
    queryFn: async ({ signal }) => {
      const body = await api.get<PaginatedEnvelope<Shipment>>("/shipments", { query: { page, limit }, signal });
      return { items: body.data, meta: body.meta };
    },
    placeholderData: keepPreviousData,
  });
}
