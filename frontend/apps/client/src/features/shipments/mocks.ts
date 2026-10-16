import { http, HttpResponse } from "msw/http";

import type { ApiErrorBody } from "@trans/api";

import type { PaginatedEnvelope, Shipment, SuccessEnvelope } from "./types";

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
    const trackingId = String(params.trackingId).toLowerCase();
    const shipment = MOCK_EMPTY ? undefined : SHIPMENTS.find((s) => s.trackingId.toLowerCase() === trackingId);
    if (!shipment) {
      return HttpResponse.json(
        {
          statusCode: 404,
          messages: ["Shipment not found."],
          timestamp: new Date().toISOString(),
          traceId: "mock",
        } satisfies ApiErrorBody,
        { status: 404 },
      );
    }
    return HttpResponse.json({ success: true, statusCode: 200, data: shipment } satisfies SuccessEnvelope<Shipment>);
  }),
];
