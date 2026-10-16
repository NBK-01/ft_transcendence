import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@trans/api";

import { WAITING_ON_ADMIN } from "./stages";
import type {
  PaginatedEnvelope,
  PaymentInput,
  Shipment,
  ShipmentDetail,
  ShipmentEvent,
  ShipmentFile,
  ShipmentFilters,
  SuccessEnvelope,
} from "./types";

/** Query keys for shipments. Client-local until admin needs them too. */
export const shipmentKeys = {
  all: ["shipments"] as const,
  list: (filters: ShipmentFilters) => [...shipmentKeys.all, "list", filters] as const,
  detail: (trackingId: string) => [...shipmentKeys.all, "detail", trackingId] as const,
  events: (trackingId: string) => [...shipmentKeys.detail(trackingId), "events"] as const,
  files: (trackingId: string) => [...shipmentKeys.detail(trackingId), "files"] as const,
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

/** While the admin has the next move, check for changes this often. */
const ADMIN_POLL_MS = 10_000;

/**
 * GET /shipments/:trackingId — one shipment with its details. A 404 means it doesn't exist (or isn't the caller's).
 * Polls while waiting on the admin (sourcing, payment confirmation) so the page updates by itself.
 */
export function useShipment(trackingId: string) {
  return useQuery({
    queryKey: shipmentKeys.detail(trackingId),
    queryFn: async ({ signal }) => {
      const body = await api.get<SuccessEnvelope<ShipmentDetail>>(`/shipments/${encodeURIComponent(trackingId)}`, {
        signal,
      });
      return body.data;
    },
    refetchInterval: (query) =>
      query.state.data && WAITING_ON_ADMIN.has(query.state.data.status) ? ADMIN_POLL_MS : false,
  });
}

/** GET /shipments/:trackingId/events — the shipment's history, newest first. */
export function useShipmentEvents(trackingId: string) {
  return useQuery({
    queryKey: shipmentKeys.events(trackingId),
    queryFn: async ({ signal }) => {
      const body = await api.get<SuccessEnvelope<ShipmentEvent[]>>(
        `/shipments/${encodeURIComponent(trackingId)}/events`,
        { signal },
      );
      return body.data;
    },
  });
}

/** GET /shipments/:trackingId/files — photos, proof of delivery and other attachments, newest first. */
export function useShipmentFiles(trackingId: string) {
  return useQuery({
    queryKey: shipmentKeys.files(trackingId),
    queryFn: async ({ signal }) => {
      const body = await api.get<SuccessEnvelope<ShipmentFile[]>>(
        `/shipments/${encodeURIComponent(trackingId)}/files`,
        { signal },
      );
      return body.data;
    },
  });
}

const shipmentPath = (trackingId: string, suffix = "") => `/shipments/${encodeURIComponent(trackingId)}${suffix}`;

/** After any change: the list, this shipment, its timeline and files are all stale. */
function useInvalidateShipments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: shipmentKeys.all });
}

/** POST /shipments (multipart): a product link or up to 5 photos. Starts in pending_sourcing. */
export function useCreateShipment() {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: async (input: { productUrl: string } | { images: File[] }) => {
      const form = new FormData();
      if ("productUrl" in input) form.set("productUrl", input.productUrl);
      else for (const image of input.images) form.append("images", image);
      const body = await api.post<SuccessEnvelope<ShipmentDetail>>("/shipments", form);
      return body.data;
    },
    onSuccess: invalidate,
  });
}

/** POST /shipments/:trackingId/offer/accept → pending_payment. */
export function useAcceptOffer(trackingId: string) {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: () => api.post<SuccessEnvelope<ShipmentDetail>>(shipmentPath(trackingId, "/offer/accept")),
    onSuccess: invalidate,
  });
}

/** POST /shipments/:trackingId/offer/reject → back to pending_sourcing for a new offer. */
export function useRejectOffer(trackingId: string) {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: () => api.post<SuccessEnvelope<ShipmentDetail>>(shipmentPath(trackingId, "/offer/reject")),
    onSuccess: invalidate,
  });
}

/** POST /shipments/:trackingId/payment → pending_payment_confirmation. */
export function useSubmitPayment(trackingId: string) {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: (input: PaymentInput) =>
      api.post<SuccessEnvelope<ShipmentDetail>>(shipmentPath(trackingId, "/payment"), input),
    onSuccess: invalidate,
  });
}
