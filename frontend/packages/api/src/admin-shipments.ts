import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, type UploadOptions } from "./client";
import { isApiError } from "./errors";
import { keys } from "./keys";
import type {
  AddShipmentEventInput,
  AdminShipment,
  AdminShipmentDetail,
  AdminShipmentFilters,
  AttachmentKind,
  ConfirmShipmentPaymentInput,
  CreateShipmentOfferInput,
  ShipmentEvent,
  ShipmentFile,
  ShipmentState,
  TrackingEventStatus,
  UploadShipmentFileInput,
} from "./types";

/**
 * The staff side of shipments (backend AdminShipmentsController). Reads need
 * `shipments:read:all` (admin, support); every change needs
 * `shipments:update:org` (admin, dispatcher). A role without it gets 403 (7001).
 *
 * The constants below copy the backend (shipments/constants/shipment-state.ts,
 * the shipment and file-storage exceptions), so the screens and the mocks
 * follow the same rules. Keep them in sync.
 */

/** Backend ShipmentErrorCodes the admin screens react to. */
export const SHIPMENT_NOT_FOUND = 3001;
/** 409: not allowed from the shipment's current status, or someone moved it first. */
export const INVALID_SHIPMENT_STATE = 3002;
export const TOO_MANY_SHIPMENT_IMAGES = 3004;
/** Backend FileStorageErrorCodes: a file of the wrong type, or over MAX_SHIPMENT_FILE_BYTES. */
export const INVALID_FILE_TYPE = 9001;
export const FILE_TOO_LARGE = 9002;

/** Photos on one offer (backend MAX_REQUEST_IMAGES). */
export const MAX_OFFER_IMAGES = 5;
/** Per file, offer photos and attachments alike (backend SHIPMENT_FILE_MAX_SIZE_MB). */
export const MAX_SHIPMENT_FILE_BYTES = 10 * 1024 * 1024;
/** What an offer photo may be. */
export const SHIPMENT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
/** What an attachment may be: an image or a PDF. */
export const SHIPMENT_FILE_TYPES = [...SHIPMENT_IMAGE_TYPES, "application/pdf"] as const;

/** The kinds the Files tab lists and accepts (backend ATTACHMENT_KINDS). */
export const ATTACHMENT_KINDS = ["package_photo", "proof_of_delivery", "other"] as const satisfies readonly AttachmentKind[];

/** Once the payment is confirmed: the shipment has its route, weight and declared value (backend LIVE_STATES). */
export const LIVE_STATES: readonly ShipmentState[] = ["confirmed", "in_transit", "out_for_delivery", "delivered", "cancelled"];

/**
 * Which statuses a tracking event can move a shipment to, and from where
 * (backend TRACKING_TRANSITIONS). in_transit → in_transit is another hop;
 * out_for_delivery → in_transit a failed delivery. Anything else is 409 (3002).
 */
export const TRACKING_TRANSITIONS: Readonly<Record<TrackingEventStatus, readonly ShipmentState[]>> = {
  in_transit: ["confirmed", "in_transit", "out_for_delivery"],
  out_for_delivery: ["in_transit"],
  delivered: ["out_for_delivery"],
  cancelled: [
    "pending_sourcing",
    "pending_client_decision",
    "pending_payment",
    "pending_payment_confirmation",
    "confirmed",
    "in_transit",
    "out_for_delivery",
  ],
};

const TRACKING_EVENT_STATUSES = Object.keys(TRACKING_TRANSITIONS) as TrackingEventStatus[];

/** The tracking events that can be posted from `status`: the moves the detail page offers. */
export const trackingMovesFrom = (status: ShipmentState) =>
  TRACKING_EVENT_STATUSES.filter((next) => TRACKING_TRANSITIONS[next].includes(status));

const shipmentPath = (trackingId: string, suffix = "") => `/admin/shipments/${encodeURIComponent(trackingId)}${suffix}`;

/**
 * GET /admin/shipments: every client's shipments, most recently updated first.
 * The previous page stays on screen while the next one loads. Pages that other
 * roles can open pass `enabled: can("shipments:read:all")`.
 */
export function useAdminShipments(filters: AdminShipmentFilters = {}, { enabled = true }: { enabled?: boolean } = {}) {
  // The backend ignores a blank search, so it shares a cache entry with no search.
  const { page = 1, limit = 20, status, organizationId } = filters;
  const q = filters.q?.trim() || undefined;
  return useQuery({
    queryKey: keys.adminShipments.list({ q, status, organizationId, page, limit }),
    queryFn: ({ signal }) =>
      api.getPage<AdminShipment>("/admin/shipments", { query: { q, status, organizationId, page, limit }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** GET /admin/shipments/:trackingId, with its client. A 404 (3001) isn't retried, so a bad link fails fast. */
export function useAdminShipment(trackingId: string) {
  return useQuery({
    queryKey: keys.adminShipments.detail(trackingId),
    queryFn: ({ signal }) => api.get<AdminShipmentDetail>(shipmentPath(trackingId), { signal }),
    enabled: Boolean(trackingId),
  });
}

/** GET /admin/shipments/:trackingId/events: the timeline, newest first. */
export function useAdminShipmentEvents(trackingId: string) {
  return useQuery({
    queryKey: keys.adminShipments.events(trackingId),
    queryFn: ({ signal }) => api.get<ShipmentEvent[]>(shipmentPath(trackingId, "/events"), { signal }),
    enabled: Boolean(trackingId),
  });
}

/** GET /admin/shipments/:trackingId/files: package photos, proof of delivery and other attachments, newest first. */
export function useAdminShipmentFiles(trackingId: string) {
  return useQuery({
    queryKey: keys.adminShipments.files(trackingId),
    queryFn: ({ signal }) => api.get<ShipmentFile[]>(shipmentPath(trackingId, "/files"), { signal }),
    enabled: Boolean(trackingId),
  });
}

/**
 * A status change. Each returns the updated shipment, which goes straight into
 * its cache; its timeline gained a step and the lists and the overview's
 * numbers moved (status, order, counts), so those refetch. On a 409 (3002)
 * the page is out of date: it all refetches.
 */
function useShipmentChange<TInput extends { trackingId: string }>(
  send: (input: TInput) => Promise<AdminShipmentDetail>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (detail, { trackingId }) => {
      queryClient.setQueryData(keys.adminShipments.detail(trackingId), detail);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.adminShipments.events(trackingId) }),
        queryClient.invalidateQueries({ queryKey: keys.adminShipments.lists() }),
        queryClient.invalidateQueries({ queryKey: keys.adminShipments.stats() }),
      ]);
    },
    onError: (error, { trackingId }) => {
      if (!isApiError(error) || error.errorCode !== INVALID_SHIPMENT_STATE) return;
      void queryClient.invalidateQueries({ queryKey: keys.adminShipments.detail(trackingId) });
      void queryClient.invalidateQueries({ queryKey: keys.adminShipments.lists() });
      void queryClient.invalidateQueries({ queryKey: keys.adminShipments.stats() });
    },
  });
}

/**
 * POST /admin/shipments/:trackingId/offer (multipart): pending_sourcing →
 * pending_client_decision, and the client sees the offer. 400 (3004) over
 * MAX_OFFER_IMAGES photos, 400 (9001/9002) for a photo of the wrong type or size.
 */
export const useSendShipmentOffer = () =>
  useShipmentChange(({ trackingId, images = [], ...input }: CreateShipmentOfferInput & { trackingId: string }) => {
    const form = new FormData();
    form.set("supplierName", input.supplierName);
    form.set("unitPrice", String(input.unitPrice));
    form.set("currency", input.currency);
    if (input.note) form.set("note", input.note);
    for (const image of images) form.append("images", image);
    return api.post<AdminShipmentDetail>(shipmentPath(trackingId, "/offer"), form);
  });

/** POST /admin/shipments/:trackingId/payment/confirm: pending_payment_confirmation → confirmed, with the route and weight. */
export const useConfirmShipmentPayment = () =>
  useShipmentChange(({ trackingId, ...input }: ConfirmShipmentPaymentInput & { trackingId: string }) =>
    api.post<AdminShipmentDetail>(shipmentPath(trackingId, "/payment/confirm"), input),
  );

/**
 * POST /admin/shipments/:trackingId/events: a tracking update, or a
 * cancellation (status "cancelled", `location` saying why). Only the moves in
 * TRACKING_TRANSITIONS are allowed; see trackingMovesFrom.
 */
export const useAddShipmentEvent = () =>
  useShipmentChange(({ trackingId, ...input }: AddShipmentEventInput & { trackingId: string }) =>
    api.post<AdminShipmentDetail>(shipmentPath(trackingId, "/events"), input),
  );

/**
 * POST /admin/shipments/:trackingId/files (multipart): adds an attachment, in
 * any status. Sent with api.upload, so a big PDF can show its progress
 * (`onProgress`). The shipment itself doesn't change: only its files list does.
 */
export function useUploadShipmentFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      trackingId,
      kind,
      file,
      onProgress,
    }: UploadShipmentFileInput & { trackingId: string; onProgress?: UploadOptions["onProgress"] }) => {
      const form = new FormData();
      form.set("kind", kind);
      form.set("file", file);
      return api.upload<ShipmentFile>(shipmentPath(trackingId, "/files"), form, { onProgress });
    },
    onSuccess: (file, { trackingId }) => {
      queryClient.setQueryData<ShipmentFile[]>(keys.adminShipments.files(trackingId), (files) => files && [file, ...files]);
    },
  });
}
