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
