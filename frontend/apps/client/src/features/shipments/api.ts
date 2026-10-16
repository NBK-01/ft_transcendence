import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@trans/api";

import type { PaginatedEnvelope, Shipment, ShipmentFilters, SuccessEnvelope } from "./types";

/** Query keys for shipments. Client-local until admin needs them too. */
export const shipmentKeys = {
  all: ["shipments"] as const,
  list: (filters: ShipmentFilters) => [...shipmentKeys.all, "list", filters] as const,
  detail: (trackingId: string) => [...shipmentKeys.all, "detail", trackingId] as const,
};

/** GET /shipments?q=&status= — the caller's shipments, newest update first. */
export function useShipments(filters: ShipmentFilters = {}) {
  const { page = 1, limit = 20, q, status } = filters;
  return useQuery({
    queryKey: shipmentKeys.list({ page, limit, q, status }),
    queryFn: async ({ signal }) => {
      const body = await api.get<PaginatedEnvelope<Shipment>>("/shipments", {
        query: { page, limit, q, status },
        signal,
      });
      return { items: body.data, meta: body.meta };
    },
    placeholderData: keepPreviousData,
  });
}

/** GET /shipments/:trackingId — one shipment. A 404 means it doesn't exist (or isn't the caller's). */
export function useShipment(trackingId: string) {
  return useQuery({
    queryKey: shipmentKeys.detail(trackingId),
    queryFn: async ({ signal }) => {
      const body = await api.get<SuccessEnvelope<Shipment>>(`/shipments/${encodeURIComponent(trackingId)}`, {
        signal,
      });
      return body.data;
    },
  });
}
