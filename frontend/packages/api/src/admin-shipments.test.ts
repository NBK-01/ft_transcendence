import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ATTACHMENT_KINDS, trackingMovesFrom } from "./admin-shipments";
import { api, configureApi, type Query } from "./client";
import { internalUsers, MOCK_STAFF_PASSWORD } from "./mocks/data";
import { handlers } from "./mocks/handlers";
import { tokens } from "./session";
import type {
  AdminShipment,
  AdminShipmentDetail,
  ShipmentEvent,
  ShipmentFile,
  ShipmentState,
  StaffAuthResponse,
} from "./types";

const server = setupServer(...handlers);

const memoryStorage = () => {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
};

beforeAll(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  configureApi({ baseUrl: "http://api.test/api", getLanguage: () => "en", onSessionExpired: () => {} });
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => tokens.clear());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const staffNamed = (name: string) => internalUsers.find((user) => user.name === name)!;
const nadia = staffNamed("Nadia Haddad"); // admin: reads and changes
const maya = staffNamed("Maya Azar"); // support: reads only
const rami = staffNamed("Rami Khoury"); // dispatcher: can't read
const karim = staffNamed("Karim Saade"); // driver: neither

async function signInAs(email = nadia.email) {
  const { user, ...pair } = await api.post<StaffAuthResponse>(
    "/staff-auth/login",
    { email, password: MOCK_STAFF_PASSWORD },
    { auth: false },
  );
  tokens.set(pair, user);
}

const path = (trackingId: string, suffix = "") => `/admin/shipments/${encodeURIComponent(trackingId)}${suffix}`;
const list = (query: Query = {}) => api.getPage<AdminShipment>("/admin/shipments", { query });
const detail = (trackingId: string) => api.get<AdminShipmentDetail>(path(trackingId));
const events = (trackingId: string) => api.get<ShipmentEvent[]>(path(trackingId, "/events"));
const files = (trackingId: string) => api.get<ShipmentFile[]>(path(trackingId, "/files"));
const addEvent = (trackingId: string, body: object) => api.post<AdminShipmentDetail>(path(trackingId, "/events"), body);

/** A shipment in `status` right now. Tests move shipments, so each picks from the current list. */
async function oneIn(status: ShipmentState, pick: "first" | "last" = "first") {
  const { items } = await list({ status, limit: 100 });
  const found = pick === "first" ? items[0] : items.at(-1);
  if (!found) throw new Error(`No shipment is ${status}`);
  return found.trackingId;
}

const newestFirst = (dates: string[]) => dates.every((date, index) => index === 0 || dates[index - 1]! >= date);
const forbidden = { status: 403, errorCode: 7001 };
/** A ValidationPipe 400: messages, no error code. */
const badRequest = { status: 400, errorCode: undefined, messages: expect.arrayContaining([expect.any(String)]) };
const wrongState = { status: 409, errorCode: 3002 };

describe("admin shipments: access", () => {
  it("needs a staff token", async () => {
    await expect(list()).rejects.toMatchObject({ status: 401, errorCode: undefined });
  });

  it("support reads but can't change anything; a dispatcher or a driver can't read (403, 7001)", async () => {
    await signInAs(maya.email);
    const { items } = await list();
    const trackingId = items[0]!.trackingId;
    await expect(detail(trackingId)).resolves.toMatchObject({ trackingId });
    await expect(events(trackingId)).resolves.toBeInstanceOf(Array);
    await expect(files(trackingId)).resolves.toBeInstanceOf(Array);
    await expect(addEvent(trackingId, { status: "cancelled", location: "Test" })).rejects.toMatchObject(forbidden);
    await expect(api.post(path(trackingId, "/files"), new FormData())).rejects.toMatchObject(forbidden);

    for (const staff of [rami, karim]) {
      await signInAs(staff.email);
      await expect(list()).rejects.toMatchObject(forbidden);
      await expect(detail(trackingId)).rejects.toMatchObject(forbidden);
    }
  });
});

describe("admin shipments: the list", () => {
  beforeEach(() => signInAs());

  it("rows are the backend's AdminShipmentDto: the shipment, its client and when it was created", async () => {
    const { items } = await list();
    expect(Object.keys(items[0]!).sort()).toEqual(["client", "createdAt", "destination", "origin", "status", "trackingId", "updatedAt"]);
    expect(Object.keys(items[0]!.client).sort()).toEqual(["email", "id", "name"]);
  });

  it("is ordered by the latest update, 20 a page by default", async () => {
    const first = await list();
    const second = await list({ page: 2 });
    expect(first.meta).toEqual({ page: 1, limit: 20, totalItems: 40, totalPages: 2 });
    expect(first.items).toHaveLength(20);
    expect(second.items).toHaveLength(20);
    const all = [...first.items, ...second.items];
    expect(newestFirst(all.map((row) => row.updatedAt))).toBe(true);
    expect(new Set(all.map((row) => row.trackingId)).size).toBe(40);
  });

  it("has every status but requested, and a route only once the payment is confirmed", async () => {
    const { items } = await list({ limit: 100 });
    const statuses = new Set(items.map((row) => row.status));
    expect(statuses.size).toBe(9);
    expect(statuses.has("requested")).toBe(false);
    const ordering = ["pending_sourcing", "pending_client_decision", "pending_payment", "pending_payment_confirmation"];
    for (const row of items) {
      if (ordering.includes(row.status)) expect(row.origin).toBeNull();
      if (row.status === "in_transit" || row.status === "delivered") expect(row.origin).toEqual(expect.any(String));
    }
  });

  it("searches part of a tracking ID in any case, and filters by status", async () => {
    const { items } = await list({ status: "in_transit", limit: 100 });
    const target = items[0]!.trackingId;
    const part = target.slice(5, 8).toLowerCase();

    const found = await list({ q: `  ${part} ` });
    expect(found.items.map((row) => row.trackingId)).toContain(target);
    expect(found.items.every((row) => row.trackingId.includes(part.toUpperCase()))).toBe(true);
    expect((await list({ q: "trk-" })).meta.totalItems).toBe(40);
    // ILIKE with % escaped: a literal %, not "anything".
    expect((await list({ q: "%" })).meta.totalItems).toBe(0);

    expect(items.every((row) => row.status === "in_transit")).toBe(true);
    const both = await list({ q: part, status: "in_transit" });
    expect(both.items.every((row) => row.status === "in_transit" && row.trackingId.includes(part.toUpperCase()))).toBe(true);
    expect(await list({ status: "requested" })).toMatchObject({ items: [], meta: { totalItems: 0, totalPages: 1 } });
  });

  it("refuses a bad query with a 400", async () => {
    for (const query of [{ status: "lost" }, { page: 0 }, { page: "two" }, { limit: 101 }, { q: "x".repeat(51) }]) {
      await expect(list(query)).rejects.toMatchObject(badRequest);
    }
  });
});

describe("admin shipments: one shipment", () => {
  beforeEach(() => signInAs());

  it("is found in any case; an unknown tracking ID is 404 (3001) everywhere", async () => {
    const trackingId = await oneIn("delivered");
    await expect(detail(trackingId.toLowerCase())).resolves.toMatchObject({ trackingId });

    const notFound = { status: 404, errorCode: 3001 };
    await expect(detail("TRK-000000")).rejects.toMatchObject(notFound);
    await expect(events("TRK-000000")).rejects.toMatchObject(notFound);
    await expect(files("TRK-000000")).rejects.toMatchObject(notFound);
    await expect(addEvent("TRK-000000", { status: "cancelled", location: "Test" })).rejects.toMatchObject(notFound);
  });

  it("has an offer, a payment and a route exactly when the backend would", async () => {
    const sourcing = await detail(await oneIn("pending_sourcing"));
    expect(sourcing).toMatchObject({ offer: null, payment: null, sender: null, weightKg: null, declaredValue: null });
    expect(Boolean(sourcing.request.productUrl) !== sourcing.request.images.length > 0).toBe(true);

    const waiting = await detail(await oneIn("pending_payment_confirmation"));
    expect(waiting.offer).toMatchObject({ supplierName: expect.any(String), unitPrice: { amount: expect.any(Number) } });
    expect(waiting.payment).toMatchObject({ quantity: expect.any(Number), cardLast4: expect.stringMatching(/^\d{4}$/) });
    expect(waiting).toMatchObject({ sender: null, recipient: null, weightKg: null, declaredValue: null });

    const moving = await detail(await oneIn("in_transit"));
    expect(moving.declaredValue).toEqual(moving.payment!.total);
    expect(moving.origin).toBe(moving.sender!.city);
    expect(moving.destination).toBe(moving.recipient!.city);
    expect(moving.client).toEqual({ id: expect.any(String), name: expect.any(String), email: expect.any(String) });
  });

  it("lists its events and attachments newest first", async () => {
    const trackingId = await oneIn("delivered");
    const timeline = await events(trackingId);
    expect(timeline[0]!.status).toBe("delivered");
    expect(timeline.at(-1)).toMatchObject({ status: "pending_sourcing", location: "Request received" });
    expect(newestFirst(timeline.map((event) => event.occurredAt))).toBe(true);

    const { items } = await list({ status: "delivered", limit: 100 });
    const attachments = (await Promise.all(items.map((row) => files(row.trackingId)))).flat();
    expect(attachments.length).toBeGreaterThan(0);
    expect(attachments.every((file) => (ATTACHMENT_KINDS as readonly string[]).includes(file.kind))).toBe(true);
  });
});

describe("admin shipments: tracking events", () => {
  beforeEach(() => signInAs());

  it("an allowed move changes the status, adds a step and puts the shipment first in the list", async () => {
    const trackingId = await oneIn("confirmed", "last");
    const before = await detail(trackingId);

    const moved = await addEvent(trackingId, { status: "in_transit", location: "  Lyon hub " });
    expect(moved.status).toBe("in_transit");
    expect(moved.updatedAt > before.updatedAt).toBe(true);
    expect((await events(trackingId))[0]).toMatchObject({ status: "in_transit", location: "Lyon hub" });
    expect((await list()).items[0]!.trackingId).toBe(trackingId);

    // Another hop, then out for delivery, then delivered.
    await expect(addEvent(trackingId, { status: "in_transit", location: "Paris hub" })).resolves.toMatchObject({ status: "in_transit" });
    await expect(addEvent(trackingId, { status: "delivered", location: "Paris" })).rejects.toMatchObject(wrongState);
    await addEvent(trackingId, { status: "out_for_delivery", location: "Paris" });
    await expect(addEvent(trackingId, { status: "delivered", location: "Paris" })).resolves.toMatchObject({ status: "delivered" });
    await expect(addEvent(trackingId, { status: "cancelled", location: "Too late" })).rejects.toMatchObject(wrongState);
  });

  it("cancels from any status before delivery; a cancelled order keeps its payment as the declared value", async () => {
    const unpaid = await addEvent(await oneIn("pending_payment"), { status: "cancelled", location: "Client asked" });
    expect(unpaid).toMatchObject({ status: "cancelled", declaredValue: null });

    const paid = await addEvent(await oneIn("pending_payment_confirmation", "last"), { status: "cancelled", location: "Card refused" });
    expect(paid).toMatchObject({ status: "cancelled", sender: null });
    expect(paid.declaredValue).toEqual(paid.payment!.total);

    await expect(addEvent(paid.trackingId, { status: "cancelled", location: "Again" })).rejects.toMatchObject(wrongState);
    await expect(addEvent(await oneIn("pending_sourcing", "last"), { status: "in_transit", location: "Lyon" })).rejects.toMatchObject(wrongState);
  });

  it("checks the body before looking the shipment up (400, not 404)", async () => {
    const trackingId = await oneIn("in_transit");
    const bad = [
      { status: "lost", location: "Lyon" },
      { status: "in_transit", location: "" },
      { status: "in_transit" },
      { status: "in_transit", location: "x".repeat(201) },
      { status: "in_transit", location: "Lyon", note: "extra" },
    ];
    for (const body of bad) {
      await expect(addEvent(trackingId, body)).rejects.toMatchObject(badRequest);
    }
    await expect(addEvent("TRK-000000", { status: "lost" })).rejects.toMatchObject(badRequest);
  });

  it("trackingMovesFrom follows TRACKING_TRANSITIONS", () => {
    expect(trackingMovesFrom("pending_sourcing")).toEqual(["cancelled"]);
    expect(trackingMovesFrom("confirmed")).toEqual(["in_transit", "cancelled"]);
    expect(trackingMovesFrom("in_transit")).toEqual(["in_transit", "out_for_delivery", "cancelled"]);
    expect(trackingMovesFrom("out_for_delivery")).toEqual(["in_transit", "delivered", "cancelled"]);
    expect(trackingMovesFrom("delivered")).toEqual([]);
    expect(trackingMovesFrom("cancelled")).toEqual([]);
  });
});

describe("admin shipments: offers", () => {
  beforeEach(() => signInAs());

  const photo = (name = "front.png", type = "image/png") => new File(["photo"], name, { type });
  const offerForm = (fields: Record<string, string> = {}, images: File[] = [photo()]) => {
    const form = new FormData();
    const values = { supplierName: " Shenzhen Gadget Co. ", unitPrice: "24.9", currency: "usd", note: " In stock. ", ...fields };
    for (const [key, value] of Object.entries(values)) form.set(key, value);
    for (const image of images) form.append("images", image);
    return form;
  };
  const sendOffer = (trackingId: string, form: FormData) => api.post<AdminShipmentDetail>(path(trackingId, "/offer"), form);

  it("pending_sourcing → pending_client_decision, with the offer the client will see", async () => {
    const trackingId = await oneIn("pending_sourcing");

    const offered = await sendOffer(trackingId, offerForm());
    expect(offered.status).toBe("pending_client_decision");
    expect(offered.offer).toMatchObject({
      supplierName: "Shenzhen Gadget Co.",
      unitPrice: { amount: 24.9, currency: "USD" },
      note: "In stock.",
      images: [{ name: "front.png", url: expect.any(String) }],
    });
    expect((await events(trackingId))[0]).toMatchObject({ status: "pending_client_decision", location: "Offer from Shenzhen Gadget Co." });

    await expect(sendOffer(trackingId, offerForm())).rejects.toMatchObject(wrongState);
  });

  it("refuses a bad body (400), too many photos (3004) and a photo that isn't an image (9001)", async () => {
    const trackingId = await oneIn("pending_sourcing", "last");
    const bad: Record<string, string>[] = [
      { unitPrice: "0" },
      { unitPrice: "12.345" },
      { unitPrice: "abc" },
      { currency: "EURO" },
      { supplierName: "" },
      { quantity: "2" },
    ];
    for (const fields of bad) {
      await expect(sendOffer(trackingId, offerForm(fields))).rejects.toMatchObject(badRequest);
    }
    const six = Array.from({ length: 6 }, (_, index) => photo(`photo-${index}.png`));
    await expect(sendOffer(trackingId, offerForm({}, six))).rejects.toMatchObject({ status: 400, errorCode: 3004 });
    await expect(sendOffer(trackingId, offerForm({}, [photo("spec.pdf", "application/pdf")]))).rejects.toMatchObject({
      status: 400,
      errorCode: 9001,
    });
    // Nothing changed.
    await expect(detail(trackingId)).resolves.toMatchObject({ status: "pending_sourcing" });
  });
});

describe("admin shipments: payment confirmation", () => {
  beforeEach(() => signInAs());

  const sender = { name: "Milano Pelle", street: "Via Torino 21", city: " Milan ", postalCode: "20123", country: "IT" };
  const recipient = { name: "Chloé Lambert", street: "7 Rue de la République", city: "Lyon", country: "FR", phone: "+33 7 45 12 98 30" };
  const confirm = (trackingId: string, body: object) => api.post<AdminShipmentDetail>(path(trackingId, "/payment/confirm"), body);

  it("pending_payment_confirmation → confirmed, with the route, weight and declared value", async () => {
    const trackingId = await oneIn("pending_payment_confirmation");

    const confirmed = await confirm(trackingId, { sender, recipient, weightKg: 1.5 });
    expect(confirmed).toMatchObject({ status: "confirmed", origin: "Milan", destination: "Lyon", weightKg: 1.5 });
    expect(confirmed.sender).toEqual({ ...sender, city: "Milan" });
    expect(confirmed.recipient).toEqual(recipient);
    expect(confirmed.declaredValue).toEqual(confirmed.payment!.total);
    expect((await events(trackingId))[0]).toMatchObject({ status: "confirmed", location: "Payment confirmed" });

    await expect(confirm(trackingId, { sender, recipient, weightKg: 1.5 })).rejects.toMatchObject(wrongState);
  });

  it("refuses a bad body with a 400 naming the field", async () => {
    const trackingId = await oneIn("pending_payment_confirmation");
    const refusals: [object, string][] = [
      [{ sender, recipient, weightKg: 0 }, "weightKg"],
      [{ sender, recipient, weightKg: 1.234 }, "weightKg"],
      [{ sender: { ...sender, country: "France" }, recipient, weightKg: 1 }, "sender.country"],
      [{ sender, recipient: { ...recipient, city: "" }, weightKg: 1 }, "recipient.city"],
      [{ sender, weightKg: 1 }, "recipient"],
      [{ sender: { ...sender, floor: 2 }, recipient, weightKg: 1 }, "sender.floor"],
    ];
    for (const [body, field] of refusals) {
      await expect(confirm(trackingId, body)).rejects.toMatchObject({
        ...badRequest,
        messages: expect.arrayContaining([expect.stringContaining(field)]),
      });
    }
  });
});

describe("admin shipments: files", () => {
  beforeEach(() => signInAs());

  const upload = (trackingId: string, kind: string | null, file?: File) => {
    const form = new FormData();
    if (kind) form.set("kind", kind);
    if (file) form.set("file", file);
    return api.post<ShipmentFile>(path(trackingId, "/files"), form);
  };
  const pdf = new File(["%PDF-1.4"], "proof-of-delivery.pdf", { type: "application/pdf" });

  it("adds an attachment in any status, first in the Files tab, without touching the shipment", async () => {
    const trackingId = await oneIn("pending_sourcing");
    const before = await detail(trackingId);

    const saved = await upload(trackingId, "proof_of_delivery", pdf);
    expect(saved).toMatchObject({ name: "proof-of-delivery.pdf", kind: "proof_of_delivery", mimeType: "application/pdf", sizeBytes: 8 });
    expect((await files(trackingId))[0]).toEqual(saved);
    await expect(detail(trackingId)).resolves.toMatchObject({ status: before.status, updatedAt: before.updatedAt });
  });

  it("refuses an unknown kind (400), no file (5001), the wrong type (9001) and an unknown shipment (404)", async () => {
    const trackingId = await oneIn("delivered");
    await expect(upload(trackingId, "invoice", pdf)).rejects.toMatchObject(badRequest);
    await expect(upload(trackingId, "other")).rejects.toMatchObject({ status: 400, errorCode: 5001 });
    const script = new File(["echo"], "run.sh", { type: "application/x-sh" });
    await expect(upload(trackingId, "other", script)).rejects.toMatchObject({ status: 400, errorCode: 9001 });
    await expect(upload("TRK-000000", "other", pdf)).rejects.toMatchObject({ status: 404, errorCode: 3001 });
  });
});
