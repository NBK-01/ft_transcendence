import { http } from "msw/http";

import { SHIPMENT_FILE_NOT_DELETABLE, SHIPMENT_FILE_NOT_FOUND, SHIPMENT_IMAGE_TYPES } from "@trans/api";
import { error, ok, paginated } from "@trans/api/mocks";
import { isShipmentState, type ShipmentState } from "@trans/ui/blocks/shipment-state";

import type {
  Address,
  ImageRef,
  Money,
  PaymentInput,
  Shipment,
  ShipmentDetail,
  ShipmentEvent,
  ShipmentFile,
  SupplierOffer,
} from "./types";

/**
 * Mock shipments backend (VITE_API_MOCKS=true), shaped exactly like the real
 * API's envelopes. In-memory: actions stick until the page reloads.
 *
 * It also plays the admin: after a request or a rejection it "finds" a
 * supplier, and after a payment it "confirms" it, each ADMIN_DELAY_MS later.
 * The seeded orders don't move on their own, so each stage can be looked at.
 *
 * Doesn't require a token yet: the client has no login screen wired, and the
 * real endpoints will. Delete each handler once its real endpoint ships.
 */

const ADMIN_DELAY_MS = 15_000;
const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** VITE_MOCK_EMPTY=true: pretend the user has no shipments, to preview the empty state. */
const MOCK_EMPTY = import.meta.env.VITE_MOCK_EMPTY === "true";

type MockShipment = ShipmentDetail & {
  /** Newest first. */
  events: ShipmentEvent[];
  /** When the pretend admin makes the next move, if it has one. */
  adminMovesAt: number | null;
};

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

const now = () => new Date().toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60_000).toISOString();

const CLIENT = "Amina El Idrissi";
const address = (name: string, street: string, city: string, postalCode: string, country: string): Address => ({
  name,
  street,
  city,
  postalCode,
  country,
  phone: "+961 70 123 456",
});

/** A labelled colour block as an image, so seeded photos render without real files. */
let imageCount = 0;
function placeholderImage(label: string, hue: number): ImageRef {
  imageCount += 1;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">` +
    `<rect width="400" height="300" fill="hsl(${hue} 55% 86%)"/>` +
    `<text x="200" y="158" font-family="sans-serif" font-size="22" text-anchor="middle" fill="hsl(${hue} 40% 30%)">${label}</text>` +
    `</svg>`;
  return { id: `img-${imageCount}`, name: `${label.toLowerCase().replaceAll(" ", "-")}.svg`, url: `data:image/svg+xml,${encodeURIComponent(svg)}` };
}

const SUPPLIERS: { name: string; city: string; country: string; unitPrice: Money; product: string; hue: number }[] = [
  { name: "Shenzhen Gadget Co.", city: "Shenzhen", country: "CN", unitPrice: { amount: 24.9, currency: "USD" }, product: "Earbuds", hue: 210 },
  { name: "Istanbul Textiles", city: "Istanbul", country: "TR", unitPrice: { amount: 18, currency: "EUR" }, product: "Scarf", hue: 340 },
  { name: "Milano Pelle", city: "Milan", country: "IT", unitPrice: { amount: 89, currency: "EUR" }, product: "Leather bag", hue: 30 },
];
let offerCount = 0;
function nextOffer(): SupplierOffer {
  const supplier = SUPPLIERS[offerCount % SUPPLIERS.length]!;
  offerCount += 1;
  return {
    supplierName: supplier.name,
    unitPrice: supplier.unitPrice,
    images: [placeholderImage(`${supplier.product} front`, supplier.hue), placeholderImage(`${supplier.product} side`, supplier.hue + 20)],
    note: "In stock. Ships within 3 days of payment.",
    offeredAt: now(),
  };
}

const event = (status: ShipmentState, location: string, occurredAt = now()): ShipmentEvent => ({ status, location, occurredAt });

/** Space events 5 hours apart, ending at `end`; input oldest first, output newest first. */
function spaced(steps: [ShipmentState, string][], end: string): ShipmentEvent[] {
  const last = new Date(end).getTime();
  return steps
    .map(([status, location], index) =>
      event(status, location, new Date(last - (steps.length - 1 - index) * 5 * 60 * 60_000).toISOString()),
    )
    .reverse();
}

const ORDER_STEPS = (supplier: string): [ShipmentState, string][] => [
  ["pending_sourcing", "Request received"],
  ["pending_client_decision", `Offer from ${supplier}`],
  ["pending_payment", "Offer approved"],
  ["pending_payment_confirmation", "Payment submitted"],
];

/* ---------------------------------------------------------------------------
 * Seed data: four orders (one per stage) and five live shipments
 * ------------------------------------------------------------------------ */

const PAST_ROUTES: [string, string, string, string][] = [
  ["Istanbul", "TR", "Paris", "FR"], ["Milan", "IT", "Lyon", "FR"], ["Shenzhen", "CN", "Beirut", "LB"],
  ["Casablanca", "MA", "Marseille", "FR"], ["Tunis", "TN", "Paris", "FR"], ["Madrid", "ES", "Brussels", "BE"],
  ["Lisbon", "PT", "Paris", "FR"], ["Athens", "GR", "Beirut", "LB"], ["Cairo", "EG", "Beirut", "LB"],
  ["Dubai", "AE", "Paris", "FR"], ["Berlin", "DE", "Lyon", "FR"], ["Vienna", "AT", "Brussels", "BE"],
  ["Rome", "IT", "Marseille", "FR"], ["Amman", "JO", "Beirut", "LB"], ["Rabat", "MA", "Paris", "FR"],
  ["Porto", "PT", "Lyon", "FR"], ["Seville", "ES", "Paris", "FR"], ["Izmir", "TR", "Beirut", "LB"],
];

const emptyLive = { sender: null, recipient: null, weightKg: null, declaredValue: null } as const;

function seed(): MockShipment[] {
  const offerA = nextOffer();
  const offerB = nextOffer();
  const offerC = nextOffer();

  const orders: MockShipment[] = [
    {
      trackingId: "TRK-1A2B3C",
      origin: null,
      destination: null,
      status: "pending_sourcing",
      updatedAt: hoursAgo(2),
      request: { productUrl: "https://shop.example.com/products/wireless-earbuds", images: [] },
      offer: null,
      payment: null,
      ...emptyLive,
      events: spaced(ORDER_STEPS("").slice(0, 1), hoursAgo(2)),
      adminMovesAt: null,
    },
    {
      trackingId: "TRK-4A6F90",
      origin: null,
      destination: null,
      status: "pending_client_decision",
      updatedAt: hoursAgo(5),
      request: { productUrl: null, images: [placeholderImage("My photo 1", 120), placeholderImage("My photo 2", 140)] },
      offer: offerA,
      payment: null,
      ...emptyLive,
      events: spaced(ORDER_STEPS(offerA.supplierName).slice(0, 2), hoursAgo(5)),
      adminMovesAt: null,
    },
    {
      trackingId: "TRK-6C7D88",
      origin: null,
      destination: null,
      status: "pending_payment",
      updatedAt: hoursAgo(8),
      request: { productUrl: "https://shop.example.com/products/silk-scarf", images: [] },
      offer: offerB,
      payment: null,
      ...emptyLive,
      events: spaced(ORDER_STEPS(offerB.supplierName).slice(0, 3), hoursAgo(8)),
      adminMovesAt: null,
    },
    {
      trackingId: "TRK-3F5E72",
      origin: null,
      destination: null,
      status: "pending_payment_confirmation",
      updatedAt: hoursAgo(1),
      request: { productUrl: "https://shop.example.com/products/leather-bag", images: [] },
      offer: offerC,
      payment: { quantity: 1, total: offerC.unitPrice, cardLast4: "4242", submittedAt: hoursAgo(1) },
      ...emptyLive,
      events: spaced(ORDER_STEPS(offerC.supplierName), hoursAgo(1)),
      adminMovesAt: null,
    },
  ];

  const live = (
    trackingId: string,
    status: ShipmentState,
    updatedAt: string,
    from: Address,
    to: Address,
    weightKg: number,
    unitPrice: Money,
    quantity: number,
  ): MockShipment => {
    const supplier = from.name;
    const total = { amount: Math.round(unitPrice.amount * quantity * 100) / 100, currency: unitPrice.currency };
    const tracking: [ShipmentState, string][] = [
      ["confirmed", "Payment confirmed"],
      ["in_transit", from.city],
      ["in_transit", to.city],
      ["out_for_delivery", to.city],
      ["delivered", to.city],
    ];
    const reached =
      status === "cancelled"
        ? [...tracking.slice(0, 1), ["cancelled", "Order cancelled"] as [ShipmentState, string]]
        : tracking.slice(0, tracking.findLastIndex(([step]) => step === status) + 1);
    return {
      trackingId,
      origin: from.city,
      destination: to.city,
      status,
      updatedAt,
      request: { productUrl: `https://shop.example.com/products/${trackingId.toLowerCase()}`, images: [] },
      offer: { supplierName: supplier, unitPrice, images: [], note: null, offeredAt: hoursAgo(24 * 12) },
      payment: { quantity, total, cardLast4: "4242", submittedAt: hoursAgo(24 * 11) },
      sender: from,
      recipient: to,
      weightKg,
      declaredValue: total,
      events: spaced([...ORDER_STEPS(supplier), ...reached], updatedAt),
      adminMovesAt: null,
    };
  };

  return [
    ...orders,
    live(
      "TRK-8F3A21", "in_transit", hoursAgo(0.2),
      address("Hamra Electronics", "Rue Hamra 112", "Beirut", "1103", "LB"),
      address(CLIENT, "18 Rue Oberkampf", "Paris", "75011", "FR"),
      2.4, { amount: 90, currency: "EUR" }, 2,
    ),
    live(
      "TRK-2C9B07", "out_for_delivery", hoursAgo(0.75),
      address("Maârif Leather", "45 Boulevard Zerktouni", "Casablanca", "20250", "MA"),
      address(CLIENT, "7 Rue de la République", "Lyon", "69002", "FR"),
      0.8, { amount: 65, currency: "EUR" }, 1,
    ),
    live(
      "TRK-7D1E54", "confirmed", hoursAgo(3),
      address("Tripoli Soap House", "Rue Azmi 30", "Tripoli", "1300", "LB"),
      address(CLIENT, "Rue Gouraud 9", "Beirut", "2028", "LB"),
      12.5, { amount: 35, currency: "USD" }, 12,
    ),
    live(
      "TRK-9B0C33", "delivered", hoursAgo(24 * 3),
      address("Rivoli Papeterie", "3 Rue de Rivoli", "Paris", "75004", "FR"),
      address(CLIENT, "Rue Neuve 51", "Brussels", "1000", "BE"),
      1.2, { amount: 47.5, currency: "EUR" }, 2,
    ),
    live(
      "TRK-5E2D18", "cancelled", hoursAgo(24 * 9),
      address("Sidon Ceramics", "Rue Riad El Solh 8", "Sidon", "1600", "LB"),
      address(CLIENT, "Old Souk 4", "Byblos", "1401", "LB"),
      3.3, { amount: 50, currency: "USD" }, 3,
    ),
    // Older delivered orders, so the list has more than one page (20 per page) to try pagination on.
    ...PAST_ROUTES.map(([from, fromCountry, to, toCountry], index) =>
      live(
        `TRK-${(0x5a1000 + index * 4099).toString(16).toUpperCase()}`, "delivered", hoursAgo(24 * (14 + index * 3)),
        address(`${from} Trading`, "1 Market Street", from, "00000", fromCountry),
        address(CLIENT, "18 Rue Oberkampf", to, "75011", toCountry),
        1 + (index % 4), { amount: 20 + index * 5, currency: "EUR" }, 1 + (index % 3),
      ),
    ),
  ];
}

const store: MockShipment[] = MOCK_EMPTY ? [] : seed();

/* ---------------------------------------------------------------------------
 * The pretend admin
 * ------------------------------------------------------------------------ */

function transition(shipment: MockShipment, status: ShipmentState, location: string) {
  shipment.status = status;
  shipment.updatedAt = now();
  shipment.events.unshift(event(status, location));
}

/** Apply the admin's pending move, if its time has come. Runs on every read. */
function catchUp(shipment: MockShipment) {
  if (shipment.adminMovesAt === null || Date.now() < shipment.adminMovesAt) return;
  shipment.adminMovesAt = null;

  if (shipment.status === "pending_sourcing") {
    shipment.offer = nextOffer();
    transition(shipment, "pending_client_decision", `Offer from ${shipment.offer.supplierName}`);
  } else if (shipment.status === "pending_payment_confirmation" && shipment.offer && shipment.payment) {
    const supplier = SUPPLIERS.find((s) => s.name === shipment.offer?.supplierName) ?? SUPPLIERS[0]!;
    shipment.sender = address(supplier.name, "1 Industrial Road", supplier.city, "00000", supplier.country);
    shipment.recipient = address(CLIENT, "18 Rue Oberkampf", "Paris", "75011", "FR");
    shipment.origin = supplier.city;
    shipment.destination = "Paris";
    shipment.weightKg = 1.5 * shipment.payment.quantity;
    shipment.declaredValue = shipment.payment.total;
    transition(shipment, "confirmed", "Payment confirmed");
  }
}

/* ---------------------------------------------------------------------------
 * HTTP
 * ------------------------------------------------------------------------ */

/** Shared helpers from @trans/api/mocks envelope everything exactly like the real backend. */
const fail = (statusCode: number, message: string) => error(statusCode, [message]);

const notFound = () => fail(404, "Shipment not found.");

/** The API shape: everything but the mock's own bookkeeping (events, adminMovesAt). */
const toDetail = (s: MockShipment): ShipmentDetail => ({
  trackingId: s.trackingId,
  origin: s.origin,
  destination: s.destination,
  status: s.status,
  updatedAt: s.updatedAt,
  request: s.request,
  offer: s.offer,
  payment: s.payment,
  sender: s.sender,
  recipient: s.recipient,
  weightKg: s.weightKg,
  declaredValue: s.declaredValue,
});

const detail = (shipment: MockShipment, statusCode = 200) => ok<ShipmentDetail>(toDetail(shipment), statusCode);

function findShipment(trackingId: unknown) {
  const shipment = store.find((s) => s.trackingId.toLowerCase() === String(trackingId).toLowerCase());
  if (shipment) catchUp(shipment);
  return shipment;
}

function newTrackingId() {
  for (;;) {
    const id = `TRK-${Math.random().toString(16).slice(2, 8).toUpperCase()}`;
    if (!store.some((s) => s.trackingId === id)) return id;
  }
}

function filesFor(shipment: MockShipment): ShipmentFile[] {
  if (!["confirmed", "in_transit", "out_for_delivery", "delivered"].includes(shipment.status)) return [];
  const id = shipment.trackingId.toLowerCase();
  const files: ShipmentFile[] = [
    {
      id: `${id}-photo`,
      name: "package-photo.jpg",
      kind: "package_photo",
      mimeType: "image/jpeg",
      sizeBytes: 1_843_200,
      uploadedAt: shipment.updatedAt,
      url: "/favicon.svg",
    },
  ];
  if (shipment.status === "delivered") {
    files.unshift({
      id: `${id}-pod`,
      name: "proof-of-delivery.pdf",
      kind: "proof_of_delivery",
      mimeType: "application/pdf",
      sizeBytes: 248_000,
      uploadedAt: shipment.updatedAt,
      url: "/favicon.svg",
    });
  }
  return files;
}

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

export const handlers = [
  http.get("*/api/shipments", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 20));
    const q = params.get("q")?.trim().toLowerCase() ?? "";
    const status = params.get("status");
    if (status && !isShipmentState(status)) return fail(400, "status must be a valid shipment status");

    store.forEach(catchUp);
    const sorted = store
      .filter((s) => (!q || s.trackingId.toLowerCase().includes(q)) && (!status || s.status === status))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const rows = sorted.map(
      ({ trackingId, origin, destination, status, updatedAt }): Shipment => ({ trackingId, origin, destination, status, updatedAt }),
    );
    return paginated(rows, page, limit);
  }),

  http.post("*/api/shipments", async ({ request }) => {
    const form = await request.formData();
    const productUrl = String(form.get("productUrl") ?? "").trim();
    const images = form.getAll("images").filter((value): value is File => value instanceof File);

    if (productUrl && images.length) return fail(400, "Send a product link or photos, not both.");
    if (!productUrl && !images.length) return fail(400, "Add a product link or at least one photo.");
    if (productUrl && !isHttpUrl(productUrl)) return fail(400, "productUrl must be a URL address");
    if (images.length > MAX_IMAGES) return fail(400, `Up to ${MAX_IMAGES} photos.`);
    if (images.some((file) => !(SHIPMENT_IMAGE_TYPES as readonly string[]).includes(file.type))) {
      return fail(400, "Photos must be JPEG, PNG, WebP or GIF.");
    }
    if (images.some((file) => file.size > MAX_IMAGE_BYTES)) return fail(400, "Each photo must be 10 MB or less.");

    const shipment: MockShipment = {
      trackingId: newTrackingId(),
      origin: null,
      destination: null,
      status: "pending_sourcing",
      updatedAt: now(),
      request: {
        productUrl: productUrl || null,
        images: images.map((file, index) => ({ id: `upload-${Date.now()}-${index}`, name: file.name, url: URL.createObjectURL(file) })),
      },
      offer: null,
      payment: null,
      ...emptyLive,
      events: [event("pending_sourcing", "Request received")],
      adminMovesAt: Date.now() + ADMIN_DELAY_MS,
    };
    store.push(shipment);
    return detail(shipment, 201);
  }),

  http.get("*/api/shipments/:trackingId", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    return shipment ? detail(shipment) : notFound();
  }),

  http.post("*/api/shipments/:trackingId/offer/accept", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    if (shipment.status !== "pending_client_decision") return fail(409, "This offer can no longer be accepted.");
    transition(shipment, "pending_payment", "Offer approved");
    return detail(shipment);
  }),

  http.post("*/api/shipments/:trackingId/offer/reject", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    if (shipment.status !== "pending_client_decision") return fail(409, "This offer can no longer be rejected.");
    shipment.offer = null;
    transition(shipment, "pending_sourcing", "Offer rejected, finding another supplier");
    shipment.adminMovesAt = Date.now() + ADMIN_DELAY_MS;
    return detail(shipment);
  }),

  http.post("*/api/shipments/:trackingId/payment", async ({ params, request }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    if (shipment.status !== "pending_payment" || !shipment.offer) return fail(409, "This order isn't waiting for payment.");

    const body = (await request.json()) as Partial<PaymentInput>;
    const { quantity, card } = body;
    const year = new Date().getFullYear();
    if (!Number.isInteger(quantity) || quantity! < 1 || quantity! > 99) return fail(400, "quantity must be between 1 and 99");
    if (!card?.holderName?.trim()) return fail(400, "card.holderName should not be empty");
    if (!/^\d{4}$/.test(card.last4 ?? "")) return fail(400, "card.last4 must be 4 digits");
    if (!(card.expMonth >= 1 && card.expMonth <= 12) || !(card.expYear >= year)) return fail(400, "The card has expired.");

    const unit = shipment.offer.unitPrice;
    shipment.payment = {
      quantity: quantity!,
      total: { amount: Math.round(unit.amount * quantity! * 100) / 100, currency: unit.currency },
      cardLast4: card.last4,
      submittedAt: now(),
    };
    transition(shipment, "pending_payment_confirmation", "Payment submitted");
    shipment.adminMovesAt = Date.now() + ADMIN_DELAY_MS;
    return detail(shipment);
  }),

  http.get("*/api/shipments/:trackingId/events", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    return ok<ShipmentEvent[]>(shipment.events);
  }),

  http.get("*/api/shipments/:trackingId/files", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    return ok<ShipmentFile[]>(filesFor(shipment));
  }),

  // One of your own request photos (ShipmentsService.deleteOwnFile): only
  // while pending_sourcing, and never the last one with no product link.
  http.delete("*/api/shipments/:trackingId/files/:fileId", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    const fileId = String(params.fileId);
    const index = shipment.request.images.findIndex((image) => image.id === fileId);
    if (index === -1) return error(404, ["File not found"], SHIPMENT_FILE_NOT_FOUND);
    if (shipment.status !== "pending_sourcing") {
      return error(409, ["This file can't be deleted right now"], SHIPMENT_FILE_NOT_DELETABLE);
    }
    if (!shipment.request.productUrl && shipment.request.images.length <= 1) {
      return error(409, ["This file can't be deleted right now"], SHIPMENT_FILE_NOT_DELETABLE);
    }
    shipment.request.images.splice(index, 1);
    return ok({ message: "File removed" });
  }),
];
