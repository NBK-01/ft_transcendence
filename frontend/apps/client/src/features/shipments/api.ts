import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type UploadOptions } from "@trans/api";
import { WAITING_ON_ADMIN } from "@trans/ui/blocks/shipment-state";

import type { PaymentInput, Shipment, ShipmentDetail, ShipmentEvent, ShipmentFile, ShipmentFilters } from "./types";

const shipmentPath = (trackingId: string, suffix = "") => `/shipments/${encodeURIComponent(trackingId)}${suffix}`;

/** Query keys for shipments. Client-local until admin needs them too. */
export const shipmentKeys = {
  all: ["shipments"] as const,
  list: (filters: ShipmentFilters) => [...shipmentKeys.all, "list", filters] as const,
  detail: (trackingId: string) => [...shipmentKeys.all, "detail", trackingId] as const,
  events: (trackingId: string) => [...shipmentKeys.detail(trackingId), "events"] as const,
  files: (trackingId: string) => [...shipmentKeys.detail(trackingId), "files"] as const,
};

/**
 * The shared `api` client unwraps the backend's { success, statusCode, data } envelope:
 * `api.get` / `api.post` return `data`, and `api.getPage` returns `{ items, meta }`.
 */

/** GET /shipments?q=&status=&page= — the caller's shipments, newest update first. */
export function useShipments(filters: ShipmentFilters = {}) {
  const { page = 1, limit = 20, q, status } = filters;
  return useQuery({
    queryKey: shipmentKeys.list({ page, limit, q, status }),
    queryFn: ({ signal }) => api.getPage<Shipment>("/shipments", { query: { page, limit, q, status }, signal }),
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
    queryFn: ({ signal }) => api.get<ShipmentDetail>(shipmentPath(trackingId), { signal }),
    refetchInterval: (query) =>
      query.state.data && WAITING_ON_ADMIN.has(query.state.data.status) ? ADMIN_POLL_MS : false,
  });
}

/** GET /shipments/:trackingId/events — the shipment's history, newest first. */
export function useShipmentEvents(trackingId: string) {
  return useQuery({
    queryKey: shipmentKeys.events(trackingId),
    queryFn: ({ signal }) => api.get<ShipmentEvent[]>(shipmentPath(trackingId, "/events"), { signal }),
  });
}

/** GET /shipments/:trackingId/files — photos, proof of delivery and other attachments, newest first. */
export function useShipmentFiles(trackingId: string) {
  return useQuery({
    queryKey: shipmentKeys.files(trackingId),
    queryFn: ({ signal }) => api.get<ShipmentFile[]>(shipmentPath(trackingId, "/files"), { signal }),
  });
}

/** After any change: the list, this shipment, its timeline and files are all stale. */
function useInvalidateShipments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: shipmentKeys.all });
}

/**
 * POST /shipments (multipart): a product link or up to 5 photos. Starts in
 * pending_sourcing. Sent with api.upload, so photos' upload progress is
 * reported (`onProgress`).
 */
export function useCreateShipment() {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: (
      input: ({ productUrl: string } | { images: File[] }) & { onProgress?: UploadOptions["onProgress"] },
    ) => {
      const form = new FormData();
      if ("productUrl" in input) form.set("productUrl", input.productUrl);
      else for (const image of input.images) form.append("images", image);
      return api.upload<ShipmentDetail>("/shipments", form, { onProgress: input.onProgress });
    },
    onSuccess: invalidate,
  });
}

/**
 * DELETE /shipments/:trackingId/files/:fileId — one of your own request
 * photos. Only while pending_sourcing, and never the last one with no
 * product link (409/3007 from the backend either way).
 */
export function useDeleteShipmentFile(trackingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => api.delete(shipmentPath(trackingId, `/files/${encodeURIComponent(fileId)}`)),
    onSuccess: (_result, fileId) => {
      queryClient.setQueryData<ShipmentDetail>(shipmentKeys.detail(trackingId), (shipment) =>
        shipment
          ? { ...shipment, request: { ...shipment.request, images: shipment.request.images.filter((image) => image.id !== fileId) } }
          : shipment,
      );
    },
  });
}

/** POST /shipments/:trackingId/offer/accept → pending_payment. */
export function useAcceptOffer(trackingId: string) {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: () => api.post<ShipmentDetail>(shipmentPath(trackingId, "/offer/accept")),
    onSuccess: invalidate,
  });
}

/** POST /shipments/:trackingId/offer/reject → back to pending_sourcing for a new offer. */
export function useRejectOffer(trackingId: string) {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: () => api.post<ShipmentDetail>(shipmentPath(trackingId, "/offer/reject")),
    onSuccess: invalidate,
  });
}

/** POST /shipments/:trackingId/payment → pending_payment_confirmation. */
export function useSubmitPayment(trackingId: string) {
  const invalidate = useInvalidateShipments();
  return useMutation({
    mutationFn: (input: PaymentInput) =>
      api.post<ShipmentDetail>(shipmentPath(trackingId, "/payment"), input),
    onSuccess: invalidate,
  });
}
