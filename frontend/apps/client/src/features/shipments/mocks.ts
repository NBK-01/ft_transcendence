import { http, HttpResponse } from "msw/http";

import type { ApiErrorBody } from "@trans/api";

import type {
  Address,
  PaginatedEnvelope,
  Shipment,
  ShipmentDetail,
  ShipmentEvent,
  ShipmentFile,
  SuccessEnvelope,
} from "./types";

/**
 * Mock GET /api/shipments (VITE_API_MOCKS=true), shaped exactly like the
 * backend's paginated envelope. Delete once the real endpoint ships.
 *
 * Doesn't require a token yet: the client has no login screen wired, and the
 * real endpoint will. Add the auth check here when login lands.
 */

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

const SHIPMENTS: Shipment[] = [
  { trackingId: "TRK-8F3A21", origin: "Beirut", destination: "Paris", status: "in_transit", updatedAt: minutesAgo(12) },
  { trackingId: "TRK-2C9B07", origin: "Casablanca", destination: "Lyon", status: "out_for_delivery", updatedAt: minutesAgo(45) },
  { trackingId: "TRK-7D1E54", origin: "Tripoli", destination: "Beirut", status: "confirmed", updatedAt: minutesAgo(180) },
  { trackingId: "TRK-4A6F90", origin: "Marseille", destination: "Rabat", status: "requested", updatedAt: minutesAgo(60 * 26) },
  { trackingId: "TRK-9B0C33", origin: "Paris", destination: "Brussels", status: "delivered", updatedAt: minutesAgo(60 * 24 * 3) },
  { trackingId: "TRK-5E2D18", origin: "Sidon", destination: "Byblos", status: "cancelled", updatedAt: minutesAgo(60 * 24 * 9) },
];

const SENDER = "Amina El Idrissi";
const address = (name: string, street: string, city: string, postalCode: string, country: string): Address => ({
  name,
  street,
  city,
  postalCode,
  country,
  phone: "+961 70 123 456",
});

/** Details tab data, keyed by tracking ID. */
const DETAILS: Record<string, Omit<ShipmentDetail, keyof Shipment>> = {
  "TRK-8F3A21": {
    sender: address(SENDER, "Rue Hamra 112", "Beirut", "1103", "LB"),
    recipient: address("Lucas Martin", "18 Rue Oberkampf", "Paris", "75011", "FR"),
    weightKg: 2.4,
    declaredValue: { amount: 180, currency: "EUR" },
  },
  "TRK-2C9B07": {
    sender: address(SENDER, "45 Boulevard Zerktouni", "Casablanca", "20250", "MA"),
    recipient: address("Chloé Bernard", "7 Rue de la République", "Lyon", "69002", "FR"),
    weightKg: 0.8,
    declaredValue: { amount: 65, currency: "EUR" },
  },
  "TRK-7D1E54": {
    sender: address(SENDER, "Rue Azmi 30", "Tripoli", "1300", "LB"),
    recipient: address("Karim Haddad", "Rue Gouraud 9", "Beirut", "2028", "LB"),
    weightKg: 12.5,
    declaredValue: { amount: 420, currency: "USD" },
  },
  "TRK-4A6F90": {
    sender: address(SENDER, "22 La Canebière", "Marseille", "13001", "FR"),
    recipient: address("Yasmine Alaoui", "14 Avenue Mohammed V", "Rabat", "10000", "MA"),
    weightKg: 5,
    declaredValue: { amount: 1200, currency: "MAD" },
  },
  "TRK-9B0C33": {
    sender: address(SENDER, "3 Rue de Rivoli", "Paris", "75004", "FR"),
    recipient: address("Emma Peeters", "Rue Neuve 51", "Brussels", "1000", "BE"),
    weightKg: 1.2,
    declaredValue: { amount: 95, currency: "EUR" },
  },
  "TRK-5E2D18": {
    sender: address(SENDER, "Rue Riad El Solh 8", "Sidon", "1600", "LB"),
    recipient: address("Nour Khoury", "Old Souk 4", "Byblos", "1401", "LB"),
    weightKg: 3.3,
    declaredValue: { amount: 150, currency: "USD" },
  },
};

/**
 * Mock attachments. `url` points at a file the dev server really serves, so
 * "Open" works; the real backend will return links to its file storage.
 */
function filesFor(shipment: Shipment): ShipmentFile[] {
  if (shipment.status === "requested") return [];
  const at = (hoursBefore: number) =>
    new Date(new Date(shipment.updatedAt).getTime() - hoursBefore * 60 * 60_000).toISOString();
  const id = shipment.trackingId.toLowerCase();
  const files: ShipmentFile[] = [
    {
      id: `${id}-photo`,
      name: "package-photo.jpg",
      kind: "package_photo",
      mimeType: "image/jpeg",
      sizeBytes: 1_843_200,
      uploadedAt: at(20),
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
      uploadedAt: at(0),
      url: "/favicon.svg",
    });
  }
  return files;
}

/** A believable history for a mock shipment, ending at its current status. Newest first. */
function eventsFor(shipment: Shipment): ShipmentEvent[] {
  const { origin, destination } = shipment;
  const steps: Omit<ShipmentEvent, "occurredAt">[] = [
    { status: "requested", location: origin },
    { status: "confirmed", location: `${origin} branch` },
    { status: "in_transit", location: `${origin} hub` },
    { status: "in_transit", location: `${destination} hub` },
    { status: "out_for_delivery", location: destination },
    { status: "delivered", location: destination },
  ];
  const history =
    shipment.status === "cancelled"
      ? [...steps.slice(0, 2), { status: "cancelled" as const, location: `${origin} branch` }]
      : steps.slice(0, steps.findLastIndex((step) => step.status === shipment.status) + 1);

  // Last event at updatedAt, each earlier one 5 hours before the next.
  const last = new Date(shipment.updatedAt).getTime();
  return history
    .map((step, index) => ({
      ...step,
      occurredAt: new Date(last - (history.length - 1 - index) * 5 * 60 * 60_000).toISOString(),
    }))
    .reverse();
}

const notFound = () =>
  HttpResponse.json(
    {
      statusCode: 404,
      messages: ["Shipment not found."],
      timestamp: new Date().toISOString(),
      traceId: "mock",
    } satisfies ApiErrorBody,
    { status: 404 },
  );

const findShipment = (trackingId: unknown) =>
  MOCK_EMPTY ? undefined : SHIPMENTS.find((s) => s.trackingId.toLowerCase() === String(trackingId).toLowerCase());

/** VITE_MOCK_EMPTY=true: pretend the user has no shipments, to preview the empty state. */
const MOCK_EMPTY = import.meta.env.VITE_MOCK_EMPTY === "true";

export const shipmentHandlers = [
  http.get("*/api/shipments", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.get("limit")) || 20));

    const q = params.get("q")?.trim().toLowerCase() ?? "";
    const status = params.get("status");

    const sorted = (MOCK_EMPTY ? [] : SHIPMENTS).filter(
      (shipment) =>
        (!q || shipment.trackingId.toLowerCase().includes(q)) && (!status || shipment.status === status),
    ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const items = sorted.slice((page - 1) * limit, page * limit);

    return HttpResponse.json({
      success: true,
      statusCode: 200,
      data: items,
      meta: { page, limit, totalItems: sorted.length, totalPages: Math.max(1, Math.ceil(sorted.length / limit)) },
    } satisfies PaginatedEnvelope<Shipment>);
  }),

  http.get("*/api/shipments/:trackingId", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    const details = shipment && DETAILS[shipment.trackingId];
    if (!shipment || !details) return notFound();
    return HttpResponse.json({
      success: true,
      statusCode: 200,
      data: { ...shipment, ...details },
    } satisfies SuccessEnvelope<ShipmentDetail>);
  }),

  http.get("*/api/shipments/:trackingId/events", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    return HttpResponse.json({
      success: true,
      statusCode: 200,
      data: eventsFor(shipment),
    } satisfies SuccessEnvelope<ShipmentEvent[]>);
  }),

  http.get("*/api/shipments/:trackingId/files", ({ params }) => {
    const shipment = findShipment(params.trackingId);
    if (!shipment) return notFound();
    return HttpResponse.json({
      success: true,
      statusCode: 200,
      data: filesFor(shipment),
    } satisfies SuccessEnvelope<ShipmentFile[]>);
  }),
];
