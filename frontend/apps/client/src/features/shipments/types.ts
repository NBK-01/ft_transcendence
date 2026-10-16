import type { ShipmentStatus } from "@trans/ui/blocks/status";

/**
 * A shipment as the client list shows it. Hand-written until the backend's
 * ShipmentsModule ships — then align field names with its DTO.
 */
export type Shipment = {
  trackingId: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  /** ISO 8601 timestamp of the last status change. */
  updatedAt: string;
};

export type Address = {
  name: string;
  street: string;
  city: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "FR". Shown as a translated country name. */
  country: string;
  phone?: string;
};

/** GET /shipments/:trackingId — the list fields plus what the Details tab shows. */
export type ShipmentDetail = Shipment & {
  sender: Address;
  recipient: Address;
  weightKg: number;
  declaredValue: {
    amount: number;
    /** ISO 4217, e.g. "EUR". */
    currency: string;
  };
};

/** A file attached to a shipment (the Files tab). */
export type ShipmentFile = {
  id: string;
  name: string;
  kind: "package_photo" | "proof_of_delivery" | "other";
  mimeType: string;
  sizeBytes: number;
  /** ISO 8601 timestamp. */
  uploadedAt: string;
  /** Where the browser opens or downloads it. */
  url: string;
};

/** One step in a shipment's history (the Timeline tab). */
export type ShipmentEvent = {
  status: ShipmentStatus;
  /** Where it happened, e.g. "Lyon hub". */
  location: string;
  /** ISO 8601 timestamp. */
  occurredAt: string;
};

/** Backend pagination meta (backend/src/common/dto/paginated-response.dto.ts). */
export type PaginationMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

/** What ResponseInterceptor sends for a single resource. */
export type SuccessEnvelope<T> = {
  success: true;
  statusCode: number;
  data: T;
};

/** What ResponseInterceptor sends for a paginated list endpoint. */
export type PaginatedEnvelope<T> = {
  success: true;
  statusCode: number;
  data: T[];
  meta: PaginationMeta;
};

export type ShipmentFilters = {
  page?: number;
  limit?: number;
  /** Tracking ID search (partial, case-insensitive). */
  q?: string;
  status?: ShipmentStatus;
};
