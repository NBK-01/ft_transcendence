import type { ShipmentState } from "@trans/ui/blocks/shipment-state";

/**
 * A shipment as the client list shows it. Hand-written until the backend's
 * ShipmentsModule ships — then align field names with its DTO.
 */
export type Shipment = {
  trackingId: string;
  /** Unknown (null) until the order is live and the supplier's location is set. */
  origin: string | null;
  destination: string | null;
  status: ShipmentState;
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

export type Money = {
  amount: number;
  /** ISO 4217, e.g. "EUR". */
  currency: string;
};

export type ImageRef = {
  id: string;
  url: string;
  name: string;
};

/** What the client asked for: a product link or photos of it. */
export type ShipmentRequest = {
  productUrl: string | null;
  images: ImageRef[];
};

/** What the admin found: shown to the client in pending_client_decision. */
export type SupplierOffer = {
  supplierName: string;
  unitPrice: Money;
  images: ImageRef[];
  /** Optional note from the admin, e.g. colour or delivery estimate. */
  note: string | null;
  offeredAt: string;
};

/** What the client submitted at checkout. Never the full card number. */
export type PaymentSummary = {
  quantity: number;
  total: Money;
  cardLast4: string;
  submittedAt: string;
};

/** GET /shipments/:trackingId — the list fields plus everything the detail page shows. */
export type ShipmentDetail = Shipment & {
  request: ShipmentRequest;
  /** Present from pending_client_decision on; null while sourcing. */
  offer: SupplierOffer | null;
  /** Present from pending_payment_confirmation on. */
  payment: PaymentSummary | null;
  /** The four below are null until the order is live (payment confirmed). */
  sender: Address | null;
  recipient: Address | null;
  weightKg: number | null;
  declaredValue: Money | null;
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
  status: ShipmentState;
  /** Where it happened, e.g. "Lyon hub". */
  location: string;
  /** ISO 8601 timestamp. */
  occurredAt: string;
};

/** POST /shipments/:trackingId/payment body. The card number and CVC are checked in the browser, never sent. */
export type PaymentInput = {
  quantity: number;
  card: {
    holderName: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
};

export type ShipmentFilters = {
  page?: number;
  limit?: number;
  /** Tracking ID search (partial, case-insensitive). */
  q?: string;
  status?: ShipmentState;
};
