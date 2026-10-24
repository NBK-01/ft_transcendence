import { http } from "msw/http";

import {
  ATTACHMENT_KINDS,
  FILE_TOO_LARGE,
  INVALID_FILE_TYPE,
  INVALID_SHIPMENT_STATE,
  LIVE_STATES,
  MAX_OFFER_IMAGES,
  MAX_SHIPMENT_FILE_BYTES,
  SHIPMENT_FILE_TYPES,
  SHIPMENT_IMAGE_TYPES,
  SHIPMENT_NOT_FOUND,
  TOO_MANY_SHIPMENT_IMAGES,
  TRACKING_TRANSITIONS,
} from "../admin-shipments";
import type {
  Address,
  AdminShipment,
  AdminShipmentDetail,
  AttachmentKind,
  ImageRef,
  Money,
  PaymentSummary,
  ShipmentClient,
  ShipmentEvent,
  ShipmentFile,
  ShipmentRequest,
  ShipmentState,
  SupplierOffer,
  TrackingEventStatus,
} from "../types";
import { MOCK_USER } from "./data";
import { error, ok, paginated } from "./respond";

/**
 * Staff shipments (backend AdminShipmentsController and AdminShipmentsService).
 * `requireStaffAccess` (staff-auth.ts) checks the token and the role first:
 * reading needs "shipments:read:all", changes "shipments:update:org". Then the
 * backend's order: the body (400), the shipment (404, 3001), its status (409,
 * 3002), the files (400, 3004 / 9001 / 9002).
 *
 * Forty shipments from seven clients over the last six weeks; at least eleven
 * changed today, three of them new requests. Every status has some except
 * "requested", which nothing sets. Amina (MOCK_USER, the client app's
 * customer) has the same tracking IDs and statuses as in the client's own
 * mocks. In-memory: changes stick until the page reloads.
 *
 * The client app mocks /api/shipments itself (apps/client/src/features/shipments/mocks.ts);
 * these handlers only answer /api/admin/shipments.
 */

/** Backend ValidationErrorCodes.MissingRequiredData: the upload has no file. */
const MISSING_REQUIRED_DATA = 5001;

const STATES: readonly ShipmentState[] = [
  "pending_sourcing",
  "pending_client_decision",
  "pending_payment",
  "pending_payment_confirmation",
  "requested",
  "confirmed",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
];
const TRACKING_EVENT_STATUSES = Object.keys(TRACKING_TRANSITIONS) as TrackingEventStatus[];

type Offer = SupplierOffer & { rejectedAt: string | null };

type Row = {
  /** Breaks ties in the list order, like the backend's id. */
  id: string;
  trackingId: string;
  client: ShipmentClient;
  status: ShipmentState;
  request: ShipmentRequest;
  /** Every offer made, oldest first. The client sees the newest one not rejected. */
  offers: Offer[];
  payment: PaymentSummary | null;
  /** Origin and destination are the sender's and recipient's cities. */
  sender: Address | null;
  recipient: Address | null;
  weightKg: number | null;
  /** Newest first. */
  events: ShipmentEvent[];
  /** The Files tab's attachments, newest first. */
  files: ShipmentFile[];
  createdAt: string;
  updatedAt: string;
};

/* ---------------------------------------------------------------------------
 * Files that open offline: blob URLs, never an external host
 * ------------------------------------------------------------------------ */

let ids = 0;
const nextId = (group: string) => `00000000-0000-4000-${group}-${String(++ids).padStart(12, "0")}`;

const blobUrl = (content: string, type: string) => URL.createObjectURL(new Blob([content], { type }));

/** A labelled colour block, drawn as SVG. */
function picture(label: string, hue: number) {
  return blobUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">` +
      `<rect width="400" height="300" fill="hsl(${hue} 55% 86%)"/>` +
      `<text x="200" y="158" font-family="sans-serif" font-size="22" text-anchor="middle" fill="hsl(${hue} 40% 30%)">${label}</text>` +
      `</svg>`,
    "image/svg+xml",
  );
}

/** A one-page PDF with a line of (ASCII) text. */
function pdfDocument(text: string) {
  const content = `BT /F1 20 Tf 72 760 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return blobUrl(pdf, "application/pdf");
}

const image = (label: string, hue: number): ImageRef => ({
  id: nextId("9100"),
  url: picture(label, hue),
  name: `${label.toLowerCase().replaceAll(" ", "-")}.jpg`,
});

/* ---------------------------------------------------------------------------
 * Seed data
 * ------------------------------------------------------------------------ */

const address = (name: string, street: string, city: string, postalCode: string | null, country: string, phone?: string): Address => ({
  name,
  street,
  city,
  ...(postalCode && { postalCode }),
  country,
  ...(phone && { phone }),
});

const customer = (
  id: string,
  name: string,
  email: string,
  [street, city, postalCode, country, phone]: [string, string, string, string, string],
) => ({ client: { id, name, email }, home: address(name, street, city, postalCode, country, phone) });

/** Each client, with the home their orders go to. Rania is the customer in chat.ts's second support conversation. */
const CLIENTS = [
  customer(MOCK_USER.id, MOCK_USER.name, MOCK_USER.email, ["18 Rue Oberkampf", "Paris", "75011", "FR", "+33 6 12 34 56 78"]),
  customer("8f0c1d2e-0000-4000-8000-000000000002", "Rania Khalil", "rania.khalil@example.com", ["Rue Gouraud 22", "Beirut", "2028", "LB", "+961 3 456 789"]),
  customer("8f0c1d2e-0000-4000-8000-000000000003", "Sofia Bennani", "sofia.bennani@example.com", ["12 Rue Ibnou Mounir", "Casablanca", "20250", "MA", "+212 6 61 23 45 67"]),
  customer("8f0c1d2e-0000-4000-8000-000000000004", "Jad Aoun", "jad.aoun@example.org", ["Avenue Fouad Chehab 40", "Jounieh", "1200", "LB", "+961 71 234 567"]),
  customer("8f0c1d2e-0000-4000-8000-000000000005", "Chloé Lambert", "chloe.lambert@example.com", ["7 Rue de la République", "Lyon", "69002", "FR", "+33 7 45 12 98 30"]),
  customer("8f0c1d2e-0000-4000-8000-000000000006", "Yasmine Saleh", "yasmine.saleh@example.com", ["25 Rue de la Joliette", "Marseille", "13002", "FR", "+33 6 98 76 54 32"]),
  customer("8f0c1d2e-0000-4000-8000-000000000007", "Lina Farah", "lina.farah@example.org", ["Rue Neuve 51", "Brussels", "1000", "BE", "+32 470 12 34 56"]),
];

/** A supplier the admin finds: their address (the sender), what they sell and for how much, and the offer's note. */
const vendor = (address: Address, product: string, unitPrice: Money, kgPerUnit: number, hue: number, note: string | null = null) => ({
  address,
  product,
  unitPrice,
  kgPerUnit,
  hue,
  note,
});

const SUPPLIERS = [
  vendor(
    address("Shenzhen Gadget Co.", "88 Huaqiang North Road", "Shenzhen", "518031", "CN", "+86 755 8321 4400"),
    "Wireless earbuds", { amount: 24.9, currency: "USD" }, 0.3, 210, "In stock. Ships within 3 days of payment.",
  ),
  vendor(
    address("Istanbul Textiles", "Kalpakçılar Caddesi 14", "Istanbul", "34126", "TR"),
    "Silk scarf", { amount: 18, currency: "EUR" }, 0.2, 340, "Navy is sold out; this is the closest blue.",
  ),
  vendor(
    address("Milano Pelle", "Via Torino 21", "Milan", "20123", "IT", "+39 02 8645 1120"),
    "Leather bag", { amount: 89, currency: "EUR" }, 1.1, 30,
  ),
  vendor(
    address("Hamra Electronics", "Rue Hamra 112", "Beirut", "1103", "LB"),
    "Bluetooth speaker", { amount: 90, currency: "USD" }, 0.9, 190, "Comes with a one-year warranty.",
  ),
  vendor(
    address("Maârif Leather", "45 Boulevard Zerktouni", "Casablanca", "20250", "MA"),
    "Leather slippers", { amount: 65, currency: "EUR" }, 0.8, 20,
  ),
  vendor(
    address("Tripoli Soap House", "Rue Azmi 30", "Tripoli", "1300", "LB"),
    "Soap gift box", { amount: 35, currency: "USD" }, 1, 90, "Olive oil and laurel, boxed by six.",
  ),
  vendor(
    address("Rivoli Papeterie", "3 Rue de Rivoli", "Paris", "75004", "FR"),
    "Notebook set", { amount: 47.5, currency: "EUR" }, 0.6, 260,
  ),
  vendor(
    address("Sidon Ceramics", "Rue Riad El Solh 8", "Sidon", "1600", "LB"),
    "Ceramic bowls", { amount: 50, currency: "USD" }, 1.1, 160, "Hand-painted, so each set differs a little.",
  ),
  vendor(
    address("Dubai Perfume House", "Al Fahidi Street 9", "Dubai", null, "AE", "+971 4 353 2100"),
    "Oud perfume", { amount: 320, currency: "AED" }, 0.4, 45,
  ),
  vendor(
    address("Guangzhou Home Supply", "15 Liwan Road", "Guangzhou", "510140", "CN"),
    "Desk lamp", { amount: 38, currency: "USD" }, 1.4, 230, "Ships with an EU plug.",
  ),
  vendor(
    address("Fez Pottery Atelier", "Derb Fkih 3", "Fez", "30000", "MA"),
    "Clay tagine", { amount: 450, currency: "MAD" }, 2.2, 15,
  ),
  vendor(
    address("Lisboa Azulejos", "Rua da Prata 120", "Lisbon", "1100-420", "PT"),
    "Azulejo tiles", { amount: 12.5, currency: "EUR" }, 0.5, 205, "Sold by the tile.",
  ),
];

const CARDS = ["4242", "1881", "0005", "5100", "3007"];

/** How seeded attachments look, and the step they arrive with. Photos are SVG here; the real API stores JPEG, PNG, WebP or GIF. */
const ATTACHMENTS: Record<AttachmentKind, { name: string; mimeType: string; sizeBytes: number; after: ShipmentState }> = {
  package_photo: { name: "package.jpg", mimeType: "image/jpeg", sizeBytes: 1_843_200, after: "in_transit" },
  proof_of_delivery: { name: "proof-of-delivery.pdf", mimeType: "application/pdf", sizeBytes: 248_000, after: "delivered" },
  other: { name: "customs-declaration.pdf", mimeType: "application/pdf", sizeBytes: 96_400, after: "confirmed" },
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.now();
const MIDNIGHT = new Date(NOW).setHours(0, 0, 0, 0);
const ago = (ms: number) => NOW - ms;
/** Earlier today, `share` of the way from midnight to now: still today, whatever the time. */
const today = (share: number) => MIDNIGHT + (NOW - MIDNIGHT) * share;

type Seed = {
  trackingId: string;
  /** Indexes into CLIENTS and SUPPLIERS. */
  client: number;
  supplier: number;
  status: ShipmentState;
  /** Requested, and last changed (ms). The steps in between are spread evenly. */
  created: number;
  updated: number;
  quantity?: number;
  /** The client sent photos instead of a link. */
  photos?: boolean;
  /** A supplier whose offer the client turned down first. */
  rejected?: number;
  /** In transit, but only at its first stop. */
  firstHop?: boolean;
  /** Delivered after a failed attempt. */
  retried?: boolean;
  /** Cancelled from this status, for this reason. */
  cancelled?: [ShipmentState, string];
  files?: AttachmentKind[];
};

const SEEDS: Seed[] = [
  // Amina: the client app's shipments.
  { trackingId: "TRK-1A2B3C", client: 0, supplier: 0, status: "pending_sourcing", created: today(0.6), updated: today(0.6) },
  { trackingId: "TRK-4A6F90", client: 0, supplier: 0, status: "pending_client_decision", created: ago(30 * HOUR), updated: ago(5 * HOUR), photos: true },
  { trackingId: "TRK-6C7D88", client: 0, supplier: 1, status: "pending_payment", created: ago(3 * DAY), updated: ago(8 * HOUR) },
  { trackingId: "TRK-3F5E72", client: 0, supplier: 2, status: "pending_payment_confirmation", created: ago(4 * DAY), updated: today(0.8) },
  { trackingId: "TRK-8F3A21", client: 0, supplier: 3, status: "in_transit", created: ago(12 * DAY), updated: today(0.95), quantity: 2, files: ["package_photo"] },
  { trackingId: "TRK-2C9B07", client: 0, supplier: 4, status: "out_for_delivery", created: ago(10 * DAY), updated: today(0.9) },
  { trackingId: "TRK-7D1E54", client: 0, supplier: 5, status: "confirmed", created: ago(6 * DAY), updated: today(0.4), quantity: 12 },
  { trackingId: "TRK-9B0C33", client: 0, supplier: 11, status: "delivered", created: ago(20 * DAY), updated: ago(3 * DAY), quantity: 8, files: ["package_photo", "proof_of_delivery"] },
  { trackingId: "TRK-5E2D18", client: 0, supplier: 7, status: "cancelled", created: ago(25 * DAY), updated: ago(9 * DAY), quantity: 3, cancelled: ["in_transit", "Damaged in transit, refunded"] },
  // Rania
  { trackingId: "TRK-B41C07", client: 1, supplier: 9, status: "pending_sourcing", created: today(0.3), updated: today(0.3), photos: true },
  { trackingId: "TRK-0E93D4", client: 1, supplier: 8, status: "pending_client_decision", created: ago(2 * DAY), updated: ago(20 * HOUR) },
  { trackingId: "TRK-77A1F2", client: 1, supplier: 0, status: "in_transit", created: ago(16 * DAY), updated: ago(30 * HOUR), quantity: 2, firstHop: true },
  { trackingId: "TRK-C2D5E8", client: 1, supplier: 1, status: "delivered", created: ago(38 * DAY), updated: ago(29 * DAY), quantity: 3, files: ["proof_of_delivery"] },
  { trackingId: "TRK-5F0A3B", client: 1, supplier: 2, status: "cancelled", created: ago(15 * DAY), updated: ago(8 * DAY), cancelled: ["pending_payment", "Cancelled at the client's request"] },
  { trackingId: "TRK-91BE60", client: 1, supplier: 10, status: "pending_payment_confirmation", created: ago(5 * DAY), updated: ago(26 * HOUR) },
  // Sofia
  { trackingId: "TRK-3DA8C1", client: 2, supplier: 2, status: "pending_sourcing", created: ago(3 * DAY), updated: ago(30 * HOUR), rejected: 4 },
  { trackingId: "TRK-E6017B", client: 2, supplier: 0, status: "pending_payment", created: ago(4 * DAY), updated: ago(2 * DAY), quantity: 2 },
  { trackingId: "TRK-28F4A9", client: 2, supplier: 11, status: "confirmed", created: ago(9 * DAY), updated: ago(2 * DAY), quantity: 24, files: ["other"] },
  { trackingId: "TRK-A9C3E5", client: 2, supplier: 8, status: "out_for_delivery", created: ago(14 * DAY), updated: today(0.7), files: ["package_photo"] },
  { trackingId: "TRK-4E7B12", client: 2, supplier: 1, status: "delivered", created: ago(30 * DAY), updated: ago(21 * DAY), retried: true, files: ["other", "proof_of_delivery"] },
  { trackingId: "TRK-D05F6C", client: 2, supplier: 9, status: "in_transit", created: ago(18 * DAY), updated: ago(4 * DAY) },
  // Jad
  { trackingId: "TRK-6B9E04", client: 3, supplier: 9, status: "pending_client_decision", created: ago(30 * HOUR), updated: ago(6 * HOUR), photos: true },
  { trackingId: "TRK-F1C8D2", client: 3, supplier: 3, status: "in_transit", created: ago(4 * DAY), updated: today(0.85), firstHop: true },
  { trackingId: "TRK-0B2A7E", client: 3, supplier: 10, status: "delivered", created: ago(41 * DAY), updated: ago(33 * DAY) },
  { trackingId: "TRK-8C6F31", client: 3, supplier: 0, status: "pending_payment_confirmation", created: ago(3 * DAY), updated: ago(10 * HOUR), quantity: 4 },
  { trackingId: "TRK-E2B4C9", client: 3, supplier: 8, status: "confirmed", created: ago(7 * DAY), updated: ago(DAY), quantity: 2 },
  // Chloé
  { trackingId: "TRK-7F3D58", client: 4, supplier: 11, status: "pending_sourcing", created: ago(26 * HOUR), updated: ago(26 * HOUR) },
  { trackingId: "TRK-C9E120", client: 4, supplier: 2, status: "in_transit", created: ago(8 * DAY), updated: ago(20 * HOUR) },
  { trackingId: "TRK-1D84B6", client: 4, supplier: 6, status: "delivered", created: ago(22 * DAY), updated: ago(16 * DAY), quantity: 2 },
  { trackingId: "TRK-A35F07", client: 4, supplier: 1, status: "pending_client_decision", created: ago(2 * DAY), updated: ago(28 * HOUR), photos: true },
  { trackingId: "TRK-56C2EA", client: 4, supplier: 4, status: "cancelled", created: ago(12 * DAY), updated: ago(10 * DAY), cancelled: ["pending_sourcing", "No supplier found for this model"] },
  // Yasmine
  { trackingId: "TRK-B7E9A3", client: 5, supplier: 10, status: "pending_sourcing", created: today(0.85), updated: today(0.85) },
  { trackingId: "TRK-2A61CF", client: 5, supplier: 5, status: "pending_payment", created: ago(5 * DAY), updated: ago(3 * DAY), quantity: 6 },
  { trackingId: "TRK-E80D45", client: 5, supplier: 7, status: "in_transit", created: ago(11 * DAY), updated: ago(2 * DAY), files: ["package_photo"] },
  { trackingId: "TRK-49FB16", client: 5, supplier: 0, status: "delivered", created: ago(35 * DAY), updated: ago(24 * DAY), files: ["proof_of_delivery"] },
  { trackingId: "TRK-3C0E9D", client: 5, supplier: 11, status: "pending_payment_confirmation", created: ago(2 * DAY), updated: today(0.5), quantity: 30 },
  // Lina
  { trackingId: "TRK-DB5A82", client: 6, supplier: 2, status: "confirmed", created: ago(6 * DAY), updated: today(0.2) },
  { trackingId: "TRK-61E7C4", client: 6, supplier: 9, status: "out_for_delivery", created: ago(17 * DAY), updated: ago(5 * HOUR), quantity: 2 },
  { trackingId: "TRK-8A2D6F", client: 6, supplier: 1, status: "delivered", created: ago(27 * DAY), updated: ago(19 * DAY), quantity: 2 },
  { trackingId: "TRK-F49C1B", client: 6, supplier: 8, status: "delivered", created: ago(13 * DAY), updated: ago(30 * HOUR), files: ["proof_of_delivery", "other"] },
];

type Step = [ShipmentState, string];

/** A seed's whole history, from the request to where it is now, with what each step left behind (offers, payment, route). */
function build(seed: Seed, index: number): Row {
  const { client, home } = CLIENTS[seed.client]!;
  const supplier = SUPPLIERS[seed.supplier]!;
  const quantity = seed.quantity ?? 1;

  // Every step it would take, cut where it is now.
  const path: Step[] = [["pending_sourcing", "Request received"]];
  if (seed.rejected !== undefined) {
    path.push(
      ["pending_client_decision", `Offer from ${SUPPLIERS[seed.rejected]!.address.name}`],
      ["pending_sourcing", "Offer rejected, finding another supplier"],
    );
  }
  path.push(
    ["pending_client_decision", `Offer from ${supplier.address.name}`],
    ["pending_payment", "Offer approved"],
    ["pending_payment_confirmation", "Payment submitted"],
    ["confirmed", "Payment confirmed"],
    ["in_transit", supplier.address.city],
    ["in_transit", `${home.city} hub`],
    ["out_for_delivery", home.city],
  );
  if (seed.retried) path.push(["in_transit", `${home.city} hub, no one was home`], ["out_for_delivery", home.city]);
  path.push(["delivered", home.city]);

  const [until, reason] = seed.cancelled ?? [seed.status];
  const end = seed.firstHop ? path.findIndex(([status]) => status === until) : path.findLastIndex(([status]) => status === until);
  const steps = path.slice(0, end + 1);
  if (reason) steps.push(["cancelled", reason]);

  const times = steps.map((_, step) =>
    new Date(seed.created + (steps.length > 1 ? ((seed.updated - seed.created) * step) / (steps.length - 1) : 0)).toISOString(),
  );
  const firstAt = (status: ShipmentState) => steps.findIndex(([candidate]) => candidate === status);

  const offers = steps.flatMap(([status], step): Offer[] => {
    if (status !== "pending_client_decision") return [];
    const turnedDown = seed.rejected !== undefined && step === firstAt("pending_client_decision");
    const from = turnedDown ? SUPPLIERS[seed.rejected!]! : supplier;
    return [
      {
        supplierName: from.address.name,
        unitPrice: from.unitPrice,
        images: (turnedDown ? ["front"] : ["front", "side"]).map((view) => image(`${from.product} ${view}`, from.hue)),
        note: from.note,
        offeredAt: times[step]!,
        rejectedAt: turnedDown ? times[step + 1]! : null,
      },
    ];
  });

  const paid = firstAt("pending_payment_confirmation");
  const total = { amount: Math.round(supplier.unitPrice.amount * quantity * 100) / 100, currency: supplier.unitPrice.currency };
  const live = firstAt("confirmed") >= 0;

  const files = (seed.files ?? []).map((kind): ShipmentFile => {
    const { name, mimeType, sizeBytes, after } = ATTACHMENTS[kind];
    const title = `${kind === "other" ? "Customs declaration" : "Proof of delivery"} - ${seed.trackingId}`;
    return {
      id: nextId("9100"),
      name,
      kind,
      mimeType,
      sizeBytes,
      uploadedAt: times[firstAt(after)]!,
      url: mimeType === "application/pdf" ? pdfDocument(title) : picture(`${seed.trackingId} package`, supplier.hue),
    };
  });

  return {
    id: `00000000-0000-4000-9000-${String(index + 1).padStart(12, "0")}`,
    trackingId: seed.trackingId,
    client,
    status: steps.at(-1)![0],
    request: seed.photos
      ? { productUrl: null, images: [1, 2].map((n) => image(`${supplier.product} photo ${n}`, supplier.hue + 20)) }
      : { productUrl: `https://shop.example.com/products/${supplier.product.toLowerCase().replaceAll(" ", "-")}`, images: [] },
    offers,
    payment: paid < 0 ? null : { quantity, total, cardLast4: CARDS[index % CARDS.length]!, submittedAt: times[paid]! },
    sender: live ? supplier.address : null,
    recipient: live ? home : null,
    weightKg: live ? Math.round(supplier.kgPerUnit * quantity * 100) / 100 : null,
    events: steps.map(([status, location], step) => ({ status, location, occurredAt: times[step]! })).reverse(),
    files: files.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    createdAt: times[0]!,
    updatedAt: times.at(-1)!,
  };
}

const shipments: Row[] = SEEDS.map(build);

/* ---------------------------------------------------------------------------
 * What the API returns (ShipmentFactory)
 * ------------------------------------------------------------------------ */

const toRow = (row: Row): AdminShipment => ({
  trackingId: row.trackingId,
  origin: row.sender?.city ?? null,
  destination: row.recipient?.city ?? null,
  status: row.status,
  updatedAt: row.updatedAt,
  client: row.client,
  createdAt: row.createdAt,
});

function toDetail(row: Row): AdminShipmentDetail {
  const offer = row.offers.filter((candidate) => !candidate.rejectedAt).at(-1);
  return {
    ...toRow(row),
    request: row.request,
    offer: offer
      ? { supplierName: offer.supplierName, unitPrice: offer.unitPrice, images: offer.images, note: offer.note, offeredAt: offer.offeredAt }
      : null,
    payment: row.payment,
    sender: row.sender,
    recipient: row.recipient,
    weightKg: row.weightKg,
    // Like the backend: a shipment cancelled while its payment was waiting still has one.
    declaredValue: LIVE_STATES.includes(row.status) ? (row.payment?.total ?? null) : null,
  };
}

/* ---------------------------------------------------------------------------
 * Validation, like the backend's ValidationPipe: every failing check, worded
 * like GlobalExceptionFilter's English messages, as a 400 without a code
 * ------------------------------------------------------------------------ */

type Check = string | false;
const isFailure = (check: Check): check is string => check !== false;
const invalid = (checks: Check[]) => {
  const messages = checks.filter(isFailure);
  return messages.length > 0 ? error(400, messages) : undefined;
};

/** @IsString @IsNotEmpty @MaxLength, or @IsOptional @IsString @MaxLength. */
function text(field: string, value: unknown, max: number, optional = false): Check {
  if (value === undefined || value === null) return !optional && `${field} is required`;
  if (typeof value !== "string") return `${field} must be text`;
  if (value === "" && !optional) return `${field} is required`;
  return value.length > max && `${field} must be at most ${max} characters`;
}

/** @IsNumber({ maxDecimalPlaces: 2 }) @Min @Max. */
function decimal(field: string, value: unknown, min: number, max: number): Check {
  if (typeof value !== "number" || !Number.isFinite(value) || (String(value).split(".")[1]?.length ?? 0) > 2) {
    return `${field} must be a number`;
  }
  if (value < min) return `${field} must be at least ${min}`;
  return value > max && `${field} must be at most ${max}`;
}

/** @IsIn / @IsEnum. */
const oneOf = (field: string, value: unknown, allowed: readonly string[]): Check =>
  !allowed.includes(value as string) && `${field} must be one of the following values: ${allowed.join(", ")}`;

/** forbidNonWhitelisted: a field the DTO doesn't declare. */
const unknownFields = (fields: Iterable<string>, allowed: readonly string[], prefix = ""): Check[] =>
  [...fields].filter((field) => !allowed.includes(field)).map((field) => `${prefix}${field} is not an allowed field`);

const regions = new Intl.DisplayNames(["en"], { type: "region", fallback: "none" });
const isCountry = (value: unknown) => typeof value === "string" && /^[a-z]{2}$/i.test(value) && regions.of(value.toUpperCase()) !== undefined;
const isCurrency = (value: unknown) =>
  typeof value === "string" && /^[a-z]{3}$/i.test(value) && Intl.supportedValuesOf("currency").includes(value.toUpperCase());

const ADDRESS_FIELDS = ["name", "street", "city", "postalCode", "country", "phone"];

/** AddressDto, nested. Missing altogether is a 400 here; ConfirmPaymentDto has no @IsDefined, so the real API likely fails later with a 500. */
function addressChecks(field: string, value: unknown): Check[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${field} is required`];
  const input = value as Record<string, unknown>;
  return [
    ...unknownFields(Object.keys(input), ADDRESS_FIELDS, `${field}.`),
    text(`${field}.name`, input.name, 200),
    text(`${field}.street`, input.street, 200),
    text(`${field}.city`, input.city, 100),
    text(`${field}.postalCode`, input.postalCode, 20, true),
    !isCountry(input.country) && `${field}.country must be a valid ISO31661 Alpha2 code`,
    text(`${field}.phone`, input.phone, 30, true),
  ];
}

/** FileStorageService.validateShipmentFile, on every file before any is stored. */
function fileProblem(files: File[], allowed: readonly string[]) {
  for (const file of files) {
    if (!allowed.includes(file.type)) {
      return error(400, [`File type not allowed. Accepted types: ${allowed.join(", ")}`], INVALID_FILE_TYPE);
    }
    if (file.size > MAX_SHIPMENT_FILE_BYTES) {
      return error(400, [`File exceeds the maximum size of ${MAX_SHIPMENT_FILE_BYTES / 1024 / 1024}MB`], FILE_TOO_LARGE);
    }
  }
  return undefined;
}

/* ---------------------------------------------------------------------------
 * HTTP
 * ------------------------------------------------------------------------ */

const notFound = (trackingId: unknown) => error(404, [`Shipment ${String(trackingId)} not found`], SHIPMENT_NOT_FOUND);
const wrongState = (status: ShipmentState) =>
  error(409, [`This action isn't available while the shipment is ${status}`], INVALID_SHIPMENT_STATE);

/** ShipmentsService.findOne: any case, ignoring stray spaces. */
const find = (trackingId: unknown) => shipments.find((row) => row.trackingId === String(trackingId).trim().toUpperCase());

/** ShipmentsService.transition, once the caller has checked where it may move from. */
function moveTo(row: Row, status: ShipmentState, location: string) {
  const now = new Date().toISOString();
  row.status = status;
  row.updatedAt = now;
  row.events.unshift({ status, location, occurredAt: now });
}

const json = async (request: Request) => {
  const body: unknown = await request.json().catch(() => undefined);
  return (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
};
const multipart = (request: Request) => request.formData().catch(() => new FormData());
const filesIn = (form: FormData, field: string) => form.getAll(field).filter((value): value is File => value instanceof File);

export const shipmentHandlers = [
  http.get("*/api/admin/shipments", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? 1);
    const limit = Number(params.get("limit") ?? 20);
    const q = params.get("q");
    const status = params.get("status");
    const problem = invalid([
      !(Number.isInteger(page) && page >= 1) && "page must be a whole number, at least 1",
      !(Number.isInteger(limit) && limit >= 1 && limit <= 100) && "limit must be a whole number, from 1 to 100",
      text("q", q, 50, true),
      status !== null && oneOf("status", status, STATES),
    ]);
    if (problem) return problem;

    // ILIKE '%q%' on the tracking ID, with % and _ taken literally.
    const search = q?.trim().toUpperCase();
    const rows = shipments
      .filter((row) => (!search || row.trackingId.includes(search)) && (!status || row.status === status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
    return paginated(rows.map(toRow), page, limit);
  }),

  http.get("*/api/admin/shipments/:trackingId", ({ params }) => {
    const row = find(params.trackingId);
    return row ? ok(toDetail(row)) : notFound(params.trackingId);
  }),

  http.get("*/api/admin/shipments/:trackingId/events", ({ params }) => {
    const row = find(params.trackingId);
    return row ? ok(row.events) : notFound(params.trackingId);
  }),

  http.get("*/api/admin/shipments/:trackingId/files", ({ params }) => {
    const row = find(params.trackingId);
    return row ? ok(row.files) : notFound(params.trackingId);
  }),

  http.post("*/api/admin/shipments/:trackingId/offer", async ({ params, request }) => {
    const form = await multipart(request);
    // Multipart sends numbers as text; the ValidationPipe converts them first.
    const unitPrice = form.has("unitPrice") ? Number(form.get("unitPrice")) : undefined;
    const problem = invalid([
      ...unknownFields(form.keys(), ["supplierName", "unitPrice", "currency", "note", "images"]),
      text("supplierName", form.get("supplierName"), 200),
      decimal("unitPrice", unitPrice, 0.01, 1_000_000),
      !isCurrency(form.get("currency")) && "currency must be a valid ISO4217 currency code",
      text("note", form.get("note"), 1000, true),
    ]);
    if (problem) return problem;

    const row = find(params.trackingId);
    if (!row) return notFound(params.trackingId);
    if (row.status !== "pending_sourcing") return wrongState(row.status);
    const images = filesIn(form, "images");
    if (images.length > MAX_OFFER_IMAGES) {
      return error(400, [`Up to ${MAX_OFFER_IMAGES} photos`], TOO_MANY_SHIPMENT_IMAGES);
    }
    const badFile = fileProblem(images, SHIPMENT_IMAGE_TYPES);
    if (badFile) return badFile;

    const supplierName = String(form.get("supplierName")).trim();
    moveTo(row, "pending_client_decision", `Offer from ${supplierName}`);
    row.offers.push({
      supplierName,
      unitPrice: { amount: unitPrice!, currency: String(form.get("currency")).toUpperCase() },
      images: images.map((file) => ({ id: crypto.randomUUID(), url: URL.createObjectURL(file), name: file.name })),
      note: String(form.get("note") ?? "").trim() || null,
      offeredAt: row.updatedAt,
      rejectedAt: null,
    });
    return ok(toDetail(row), 201);
  }),

  http.post("*/api/admin/shipments/:trackingId/payment/confirm", async ({ params, request }) => {
    const body = await json(request);
    const problem = invalid([
      ...unknownFields(Object.keys(body), ["sender", "recipient", "weightKg"]),
      ...addressChecks("sender", body.sender),
      ...addressChecks("recipient", body.recipient),
      decimal("weightKg", body.weightKg, 0.01, 100_000),
    ]);
    if (problem) return problem;

    const row = find(params.trackingId);
    if (!row) return notFound(params.trackingId);
    if (row.status !== "pending_payment_confirmation") return wrongState(row.status);

    const sender = body.sender as Address;
    const recipient = body.recipient as Address;
    row.sender = { ...sender, city: sender.city.trim() };
    row.recipient = { ...recipient, city: recipient.city.trim() };
    row.weightKg = body.weightKg as number;
    moveTo(row, "confirmed", "Payment confirmed");
    return ok(toDetail(row));
  }),

  http.post("*/api/admin/shipments/:trackingId/events", async ({ params, request }) => {
    const body = await json(request);
    const problem = invalid([
      ...unknownFields(Object.keys(body), ["status", "location"]),
      oneOf("status", body.status, TRACKING_EVENT_STATUSES),
      text("location", body.location, 200),
    ]);
    if (problem) return problem;

    const row = find(params.trackingId);
    if (!row) return notFound(params.trackingId);
    const status = body.status as TrackingEventStatus;
    if (!TRACKING_TRANSITIONS[status].includes(row.status)) return wrongState(row.status);

    moveTo(row, status, String(body.location).trim());
    return ok(toDetail(row), 201);
  }),

  // Any status: files don't move the shipment, or change its updatedAt.
  http.post("*/api/admin/shipments/:trackingId/files", async ({ params, request }) => {
    const form = await multipart(request);
    const problem = invalid([...unknownFields(form.keys(), ["kind", "file"]), oneOf("kind", form.get("kind"), ATTACHMENT_KINDS)]);
    if (problem) return problem;
    const [file] = filesIn(form, "file");
    if (!file) return error(400, ["file is required"], MISSING_REQUIRED_DATA);

    const row = find(params.trackingId);
    if (!row) return notFound(params.trackingId);
    const badFile = fileProblem([file], SHIPMENT_FILE_TYPES);
    if (badFile) return badFile;

    const saved: ShipmentFile = {
      id: crypto.randomUUID(),
      name: file.name,
      kind: form.get("kind") as AttachmentKind,
      mimeType: file.type,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
      url: URL.createObjectURL(file),
    };
    row.files.unshift(saved);
    return ok(saved, 201);
  }),
];
