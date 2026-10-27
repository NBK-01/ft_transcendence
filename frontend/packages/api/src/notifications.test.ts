import { MutationObserver, QueryClient, type InfiniteData, type MutationObserverOptions } from "@tanstack/react-query";
import { http } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api, configureApi, type Query } from "./client";
import { keys } from "./keys";
import { internalUsers, MOCK_STAFF_PASSWORD, MOCK_USER } from "./mocks/data";
import { createMockChatConnection } from "./mocks/chat";
import { handlers } from "./mocks/handlers";
import { notifyAction } from "./mocks/notification-store";
import { error } from "./mocks/respond";
import {
  dismissOptions,
  markAllReadOptions,
  markReadOptions,
  notificationListOptions,
  notificationsOf,
  unreadCountOptions,
} from "./notifications";
import { tokens } from "./session";
import type {
  AdminShipment,
  AdminShipmentDetail,
  AppNotification,
  AuthResponse,
  Contact,
  InternalUser,
  MessageResponse,
  NotificationCount,
  NotificationType,
  Organization,
  Page,
  ShipmentActorType,
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
const nadia = staffNamed("Nadia Haddad"); // admin
const youssef = staffNamed("Youssef Benali"); // admin
const maya = staffNamed("Maya Azar"); // support
const rami = staffNamed("Rami Khoury"); // dispatcher: no shipments:read:all
const karim = staffNamed("Karim Saade"); // driver: neither

async function signInAs(email: string) {
  const { user, ...pair } = await api.post<StaffAuthResponse>(
    "/staff-auth/login",
    { email, password: MOCK_STAFF_PASSWORD },
    { auth: false },
  );
  tokens.set(pair, user);
}

/** The client app's customer: any email signs in as Amina. */
async function signInAsAmina() {
  tokens.clear();
  tokens.set(await api.post<AuthResponse>("/auth/login", { email: MOCK_USER.email, password: "x" }, { auth: false }));
}

const list = (query: Query = {}) => api.getPage<AppNotification>("/notifications", { query });
const all = async (query: Query = {}) => (await list({ ...query, limit: 100 })).items;
const unreadCount = async () => (await api.get<NotificationCount>("/notifications/unread-count")).count;
const markRead = (id: string) => api.patch<AppNotification>(`/notifications/${id}/read`);
const markAllRead = () => api.patch<NotificationCount>("/notifications/read-all");
const dismiss = (id: string) => api.delete<MessageResponse>(`/notifications/${id}`);
/** Only the shipment updates, narrowed so their payload is typed. */
const shipmentUpdates = async () =>
  (await all({ type: "SHIPMENT_UPDATE" })).filter(
    (item): item is Extract<AppNotification, { type: "SHIPMENT_UPDATE" }> => item.type === "SHIPMENT_UPDATE",
  );

/** The statuses each side is told about: staff actions reach the customer, customer actions the staff. */
const CUSTOMER_HEARS: ShipmentState[] = ["pending_client_decision", "confirmed", "in_transit", "out_for_delivery", "delivered", "cancelled"];
const STAFF_HEAR: ShipmentState[] = ["pending_sourcing", "pending_payment", "pending_payment_confirmation"];
/** Partners (public API) and the carrier (webhook) act for neither side: both hear about their steps. */
const OUTSIDE_ACTORS: ShipmentActorType[] = ["partner", "carrier"];

const unauthorized = { status: 401, errorCode: undefined };
const notFound = { status: 404, errorCode: 12001 };
/** A ValidationPipe or ParseUUIDPipe 400: messages, no error code. */
const badRequest = { status: 400, errorCode: undefined, messages: expect.arrayContaining([expect.any(String)]) };
const UNKNOWN_ID = "00000000-0000-4000-d000-999999999999";

const newestFirst = (items: AppNotification[]) =>
  items.every((item, index) => index === 0 || items[index - 1]!.createdAt >= item.createdAt);

/** Amina's tracking IDs, read from the admin side of the same mock world. */
async function aminasTrackingIds() {
  await signInAs(nadia.email);
  const { items } = await api.getPage<AdminShipment>("/admin/shipments", { query: { limit: 100 } });
  return new Set(items.filter((row) => row.client.id === MOCK_USER.id).map((row) => row.trackingId));
}

describe("notifications: access", () => {
  it("needs a token: 401 without a code on every route", async () => {
    await expect(list()).rejects.toMatchObject(unauthorized);
    await expect(unreadCount()).rejects.toMatchObject(unauthorized);
    await expect(markAllRead()).rejects.toMatchObject(unauthorized);
    await expect(markRead(UNKNOWN_ID)).rejects.toMatchObject(unauthorized);
    await expect(dismiss(UNKNOWN_ID)).rejects.toMatchObject(unauthorized);
  });

  it("a customer gets her own shipments' staff actions, worded for her, and a record of her own steps", async () => {
    const hers = await aminasTrackingIds();
    await signInAsAmina();
    const all = await shipmentUpdates();
    const items = all.filter((item) => !item.ownAction);
    expect(items.length).toBeGreaterThan(0);
    const own = all.filter((item) => item.ownAction);
    expect(own.length).toBeGreaterThan(0);
    for (const item of own) {
      expect(hers.has(item.payload.trackingId)).toBe(true);
      expect(item.payload.actorType).toBe("customer");
      expect(item.message).toMatch(/^You /);
    }
    for (const item of items) {
      expect(hers.has(item.payload.trackingId)).toBe(true);
      expect(CUSTOMER_HEARS).toContain(item.payload.status);
      expect(item.message).toContain(item.payload.trackingId);
    }
    expect(items.map((item) => item.title)).toContain("Out for delivery");
  });

  it("admins and support get customer, partner and carrier steps on shipments, worded for staff; dispatchers and drivers none", async () => {
    for (const staff of [nadia, maya]) {
      await signInAs(staff.email);
      const items = (await shipmentUpdates()).filter((item) => !item.ownAction);
      expect(items.length).toBeGreaterThan(0);
      for (const { payload } of items) {
        const fromOutside = payload.actorType !== undefined && OUTSIDE_ACTORS.includes(payload.actorType);
        expect(fromOutside || STAFF_HEAR.includes(payload.status)).toBe(true);
        expect(payload.actorType).not.toBe("staff");
      }
      const titles = items.map((item) => item.title);
      expect(titles).toContain("Needs a supplier");
      expect(titles).toContain("New partner shipment");
    }
    for (const staff of [rami, karim]) {
      await signInAs(staff.email);
      await expect(shipmentUpdates()).resolves.toEqual([]);
    }
  });

  it("someone else's notification is a 404 (12001), and stays as it was for them", async () => {
    await signInAs(youssef.email);
    const [theirs] = await all({ unreadOnly: true });

    await signInAs(maya.email);
    await expect(markRead(theirs!.id)).rejects.toMatchObject(notFound);
    await expect(dismiss(theirs!.id)).rejects.toMatchObject(notFound);
    await signInAsAmina();
    await expect(markRead(theirs!.id)).rejects.toMatchObject(notFound);

    await signInAs(youssef.email);
    expect((await all()).find((item) => item.id === theirs!.id)).toMatchObject({ status: "SENT", readAt: null });
  });
});

describe("notifications: the list", () => {
  beforeEach(() => signInAs(nadia.email));

  it("rows are the backend's NotificationDto", async () => {
    const [first] = (await list()).items;
    expect(Object.keys(first!).sort()).toEqual(["createdAt", "id", "message", "payload", "readAt", "status", "title", "type"]);
    const [update] = await shipmentUpdates();
    expect(Object.keys(update!.payload).sort()).toEqual(["status", "trackingId"]);
  });

  it("is newest first, 20 a page by default, pages that don't overlap", async () => {
    const first = await list();
    expect(first.meta).toMatchObject({ page: 1, limit: 20 });
    expect(first.meta.totalItems).toBeGreaterThan(20);
    const second = await list({ page: 2 });
    const both = [...first.items, ...second.items];
    expect(newestFirst(both)).toBe(true);
    expect(new Set(both.map((item) => item.id)).size).toBe(both.length);
  });

  it("has read and unread ones, over several days, all delivered", async () => {
    const items = await all();
    expect(items.some((item) => item.status === "READ" && item.readAt)).toBe(true);
    expect(items.some((item) => item.status === "SENT" && item.readAt === null)).toBe(true);
    const days = new Set(items.map((item) => item.createdAt.slice(0, 10)));
    expect(days.size).toBeGreaterThan(2);
  });

  it("unreadOnly=true leaves out read ones; false is no filter; type filters", async () => {
    const everything = await all();
    const unread = await all({ unreadOnly: true });
    expect(unread.length).toBeGreaterThan(0);
    expect(unread.every((item) => item.status !== "READ")).toBe(true);
    expect(unread).toHaveLength(everything.filter((item) => item.status !== "READ").length);
    expect(await all({ unreadOnly: false })).toHaveLength(everything.length);
    for (const type of ["SHIPMENT_UPDATE", "PASSWORD_CHANGED"] as const) {
      const ofType = await all({ type });
      expect(ofType.length).toBeGreaterThan(0);
      expect(ofType).toHaveLength(everything.filter((item) => item.type === type).length);
    }
  });

  it("filters by any of the backend's types", async () => {
    const types: NotificationType[] = [
      "API_KEY_CREATED",
      "API_KEY_REVOKED",
      "CUSTOMER_REGISTERED",
      "PROFILE_UPDATED",
      "CUSTOMER_ACCOUNT_DEACTIVATED",
      "SESSIONS_REVOKED",
      "CONTACT_REQUEST_DECLINED",
      "CONTACT_REQUEST_CANCELLED",
      "CONTACT_REMOVED",
      "CONTACT_BLOCKED",
      "CONVERSATION_STARTED",
      "MESSAGE_RECEIVED",
    ];
    for (const type of types) {
      await expect(list({ type })).resolves.toMatchObject({ items: expect.any(Array) });
    }
  });

  it("signing out everywhere leaves a security notice, not a record of your own action", async () => {
    // As Nadia (this block's beforeEach); her tokens stop working, so she signs in again to read it.
    await api.post("/staff-auth/logout-all");
    await signInAs(nadia.email);

    const [notice] = await all({ type: "SESSIONS_REVOKED" });
    expect(notice).toMatchObject({ title: "Signed out everywhere", ownAction: false, status: "SENT" });
  });

  it("refuses a bad query with a 400", async () => {
    for (const query of [{ unreadOnly: "yes" }, { limit: 101 }, { limit: 0 }, { page: 0 }, { page: "two" }, { type: "NOPE" }, { sort: "old" }]) {
      await expect(list(query)).rejects.toMatchObject(badRequest);
    }
  });
});

describe("notifications: read, read all, dismiss", () => {
  beforeEach(() => signInAs(maya.email));

  it("read: READ with a readAt, once; the count goes down by one", async () => {
    const before = await unreadCount();
    const [target] = await all({ unreadOnly: true });

    const read = await markRead(target!.id);
    expect(read).toMatchObject({ id: target!.id, status: "READ", readAt: expect.any(String) });
    expect(await unreadCount()).toBe(before - 1);

    const again = await markRead(target!.id);
    expect(again.readAt).toBe(read.readAt);
    expect(await unreadCount()).toBe(before - 1);
  });

  it("read and dismiss refuse an id that isn't a UUID (400) before looking it up, and an unknown one is 404", async () => {
    await expect(markRead("not-an-id")).rejects.toMatchObject(badRequest);
    await expect(dismiss("not-an-id")).rejects.toMatchObject(badRequest);
    await expect(markRead(UNKNOWN_ID)).rejects.toMatchObject(notFound);
    await expect(dismiss(UNKNOWN_ID)).rejects.toMatchObject(notFound);
  });

  it("read all: returns how many it marked, then the count is 0", async () => {
    await signInAs(youssef.email);
    const before = await unreadCount();
    expect(before).toBeGreaterThan(0);
    await expect(markAllRead()).resolves.toEqual({ count: before });
    expect(await unreadCount()).toBe(0);
    expect(await all({ unreadOnly: true })).toEqual([]);
    await expect(markAllRead()).resolves.toEqual({ count: 0 });
  });

  it("dismiss: gone from the list and the count; then a 404 for dismiss and read", async () => {
    const before = await unreadCount();
    const total = (await list()).meta.totalItems;
    const [target] = await all({ unreadOnly: true });

    await expect(dismiss(target!.id)).resolves.toEqual({ message: "Notification dismissed" });
    expect(await unreadCount()).toBe(before - 1);
    expect((await list()).meta.totalItems).toBe(total - 1);
    expect((await all()).some((item) => item.id === target!.id)).toBe(false);

    await expect(dismiss(target!.id)).rejects.toMatchObject(notFound);
    await expect(markRead(target!.id)).rejects.toMatchObject(notFound);
  });
});

describe("notifications: admin shipment changes notify the customer", () => {
  it("an offer and a tracking update each reach Amina; the staff aren't told about their own action", async () => {
    await signInAs(nadia.email);
    const staffBefore = await unreadCount();
    const { items } = await api.getPage<AdminShipment>("/admin/shipments", { query: { limit: 100 } });
    const aminas = items.filter((row) => row.client.id === MOCK_USER.id);
    const sourcing = aminas.find((row) => row.status === "pending_sourcing")!.trackingId;
    const moving = aminas.find((row) => row.status === "in_transit")!.trackingId;

    const form = new FormData();
    form.set("supplierName", "Shenzhen Gadget Co.");
    form.set("unitPrice", "24.9");
    form.set("currency", "USD");
    await api.post<AdminShipmentDetail>(`/admin/shipments/${sourcing}/offer`, form);
    await api.post<AdminShipmentDetail>(`/admin/shipments/${moving}/events`, { status: "out_for_delivery", location: "Paris" });
    expect(await unreadCount()).toBe(staffBefore);

    await signInAsAmina();
    const [latest, previous] = (await list()).items;
    expect(latest).toMatchObject({
      status: "SENT",
      readAt: null,
      title: "Out for delivery",
      message: `${moving} is out for delivery.`,
      payload: { trackingId: moving, status: "out_for_delivery" },
    });
    expect(previous).toMatchObject({
      title: "Your offer is ready",
      payload: { trackingId: sourcing, status: "pending_client_decision" },
    });
  });
});

describe("notifications: the hooks' cache", () => {
  type Feed = InfiniteData<Page<AppNotification>, number>;

  let client: QueryClient;
  const feed = (unreadOnly = false) =>
    client.getQueryData<Feed>(notificationListOptions(unreadOnly ? { unreadOnly } : {}).queryKey);
  const items = (unreadOnly = false) => notificationsOf(feed(unreadOnly));
  const count = () => client.getQueryData<NotificationCount>(keys.notifications.unreadCount())?.count;
  const mutate = <TData, TVariables, TContext>(
    options: MutationObserverOptions<TData, Error, TVariables, TContext>,
    variables: TVariables,
  ) => new MutationObserver(client, options).mutate(variables);

  /** Holds the next matching request until `release()`, then lets the mock answer it. */
  function hold(method: "patch" | "delete", path: string) {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(http[method](path, () => gate.then(() => undefined), { once: true }));
    return release;
  }

  /** A fresh cache with `staff`'s feeds and count. Each test that changes data uses its own person. */
  async function loadFor(staff: (typeof internalUsers)[number]) {
    await signInAs(staff.email);
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await client.fetchInfiniteQuery(notificationListOptions());
    await client.fetchInfiniteQuery(notificationListOptions({ unreadOnly: true }));
    await client.fetchQuery(unreadCountOptions(client));
  }

  it("read: shown read at once (and gone from an unread-only feed), then the server's readAt", async () => {
    await loadFor(nadia);
    const target = items(true)[0]!;
    const before = count()!;
    const release = hold("patch", "*/api/notifications/:id/read");

    const done = mutate(markReadOptions(client), target.id);
    await vi.waitFor(() => expect(count()).toBe(before - 1));
    expect(items().find((item) => item.id === target.id)).toMatchObject({ status: "READ", readAt: expect.any(String) });
    expect(items(true).some((item) => item.id === target.id)).toBe(false);

    release();
    const saved = await done;
    expect(items().find((item) => item.id === target.id)).toEqual(saved);
  });

  it("read: rolls back when the server refuses", async () => {
    await loadFor(nadia);
    const target = items(true)[0]!;
    const before = count();
    server.use(http.patch("*/api/notifications/:id/read", () => error(500, ["Something went wrong"]), { once: true }));

    await expect(mutate(markReadOptions(client), target.id)).rejects.toMatchObject({ status: 500 });
    expect(count()).toBe(before);
    expect(items().find((item) => item.id === target.id)).toMatchObject({ status: "SENT", readAt: null });
    expect(items(true).some((item) => item.id === target.id)).toBe(true);
  });

  it("read all: count 0 and an empty unread-only feed at once", async () => {
    await loadFor(staffNamed("Zineb Idrissi"));
    const release = hold("patch", "*/api/notifications/read-all");
    const done = mutate(markAllReadOptions(client), undefined);
    await vi.waitFor(() => expect(count()).toBe(0));
    expect(items(true)).toEqual([]);
    expect(items().every((item) => item.status === "READ")).toBe(true);
    release();
    await expect(done).resolves.toMatchObject({ count: expect.any(Number) });
  });

  it("dismiss: out of the feeds and the count; a 404 (already gone) doesn't bring it back", async () => {
    await loadFor(staffNamed("Camille Roux"));
    const [first, second] = items(true);
    const before = count()!;

    await mutate(dismissOptions(client), first!.id);
    expect(items().some((item) => item.id === first!.id)).toBe(false);
    expect(count()).toBe(before - 1);

    server.use(http.delete("*/api/notifications/:id", () => error(404, ["Notification not found"], 12001), { once: true }));
    await expect(mutate(dismissOptions(client), second!.id)).rejects.toMatchObject({ errorCode: 12001 });
    expect(items().some((item) => item.id === second!.id)).toBe(false);
  });

  it("notificationsOf: newest first, without the duplicates a shifted page brings", async () => {
    await loadFor(nadia);
    const at = (id: string, createdAt: string) => ({ ...items()[0]!, id, createdAt });
    const page = (list: AppNotification[], number: number): Page<AppNotification> => ({
      items: list,
      meta: { page: number, limit: 2, totalItems: 3, totalPages: 2 },
    });
    const data: Feed = {
      pages: [page([at("n3", "2026-10-25T10:03"), at("n2", "2026-10-25T10:02")], 1), page([at("n2", "2026-10-25T10:02"), at("n1", "2026-10-25T10:01")], 2)],
      pageParams: [1, 2],
    };
    expect(notificationsOf(data).map((item) => item.id)).toEqual(["n3", "n2", "n1"]);
  });
});

describe("notifications: other create, update and delete actions", () => {
  const sami = staffNamed("Sami Hajj"); // driver, added to Beirut Central in the seeds
  const hiba = staffNamed("Hiba Mansour"); // support

  /** The newest notification of `type` in the signed-in account's feed. */
  const newest = async (type: NotificationType) => (await all({ type }))[0];
  const countOf = async (type: NotificationType) => (await all({ type })).length;
  /** The feed without the reader's records of their own actions. */
  const news = async (query: Query = {}) => (await all(query)).filter((item) => !item.ownAction);
  const own = async (query: Query = {}) => (await all(query)).filter((item) => item.ownAction);

  it("seeds a few for the staff, and attachments for Amina", async () => {
    await signInAs(nadia.email);
    const nadias = new Set((await all()).map((item) => item.type));
    for (const type of ["PASSWORD_CHANGED", "STAFF_ACCOUNT_CREATED", "CONTACT_REQUEST_RECEIVED", "SUPPORT_CONVERSATION_STARTED"] as const) {
      expect(nadias.has(type)).toBe(true);
    }
    // Nadia moved Anas to another branch in the seeds: she has her record of it, Youssef is told.
    expect(await news({ type: "STAFF_ACCOUNT_UPDATED" })).toEqual([]);
    expect((await own({ type: "STAFF_ACCOUNT_UPDATED" })).length).toBeGreaterThan(0);
    // Youssef created Tarek's account: the other admins heard, he has his record.
    await signInAs(youssef.email);
    expect(await news({ type: "STAFF_ACCOUNT_CREATED" })).toEqual([]);
    expect((await own({ type: "STAFF_ACCOUNT_CREATED" })).length).toBeGreaterThan(0);
    expect(await newest("STAFF_ACCOUNT_UPDATED")).toMatchObject({ payload: { name: "Anas Berrada", changed: ["branch"] } });
    await signInAs(sami.email);
    expect(await newest("BRANCH_STAFF_ADDED")).toMatchObject({ title: "Added to a branch", payload: { name: "Beirut Central" }, readAt: null });
    await signInAsAmina();
    expect(await countOf("SHIPMENT_FILE_ADDED")).toBeGreaterThan(0);
  });

  it("branches: the other admins hear about it, the branch's staff too; the admin who did it gets a record", async () => {
    await signInAs(nadia.email);
    const branch = await api.post<Organization>("/organizations", { name: "Tripoli Port" });
    await api.post(`/organizations/${branch.id}/staff/${rami.id}`);
    await api.patch(`/organizations/${branch.id}`, { description: "Opened in October" });
    await api.delete(`/organizations/${branch.id}/staff/${rami.id}`);
    // Empty again: deleted for real.
    await api.delete(`/organizations/${branch.id}`);
    const records = (await own()).filter(
      (item) => "organizationId" in item.payload && item.payload.organizationId === branch.id,
    );
    expect(records.map((item) => item.type).sort()).toEqual(
      ["BRANCH_CREATED", "BRANCH_DELETED", "BRANCH_STAFF_ADDED", "BRANCH_STAFF_REMOVED", "BRANCH_UPDATED"].sort(),
    );
    expect(records.find((item) => item.type === "BRANCH_STAFF_ADDED")).toMatchObject({
      message: "You added Rami Khoury to Tripoli Port.",
      payload: { staffName: "Rami Khoury" },
    });

    await signInAs(youssef.email);
    expect(await newest("BRANCH_CREATED")).toMatchObject({ title: "New branch", payload: { organizationId: branch.id, name: "Tripoli Port" } });
    expect(await newest("BRANCH_UPDATED")).toMatchObject({ title: "Branch updated" });
    expect(await newest("BRANCH_DELETED")).toMatchObject({ title: "Branch deleted", message: "Tripoli Port was deleted." });

    await signInAs(rami.email);
    expect(await newest("BRANCH_STAFF_ADDED")).toMatchObject({ payload: { name: "Tripoli Port" } });
    expect(await newest("BRANCH_UPDATED")).toMatchObject({ title: "Your branch was updated" });
    expect(await newest("BRANCH_STAFF_REMOVED")).toMatchObject({ message: "You're no longer part of Tripoli Port." });
    // Removed before the branch went, and a deletion is for the admins: not told about it.
    expect(await countOf("BRANCH_DELETED")).toBe(0);
  });

  it("branches: deleting one still in use is a 409 (4003); moving staff tells them they left their old branch", async () => {
    await signInAs(nadia.email);
    // Sami is in Beirut Central (seeds), so it's in use.
    const from = internalUsers.find((user) => user.id === sami.id)!.organizationId!;
    await expect(api.delete(`/organizations/${from}`)).rejects.toMatchObject({ status: 409, errorCode: 4003 });

    const branch = await api.post<Organization>("/organizations", { name: "Byblos" });
    await api.post(`/organizations/${branch.id}/staff/${sami.id}`);
    // Already there: nothing new.
    await api.post(`/organizations/${branch.id}/staff/${sami.id}`);
    await expect(api.delete(`/organizations/${from}/staff/${sami.id}`)).rejects.toMatchObject({ status: 404, errorCode: 4004 });

    await signInAs(sami.email);
    expect(await newest("BRANCH_STAFF_REMOVED")).toMatchObject({ payload: { organizationId: from } });
    const added = (await all({ type: "BRANCH_STAFF_ADDED" })).filter(
      (item) => item.type === "BRANCH_STAFF_ADDED" && item.payload.organizationId === branch.id,
    );
    expect(added).toHaveLength(1);
  });

  it("staff accounts: an update reaches the person and the other admins; a deactivation only the admins", async () => {
    await signInAs(nadia.email);
    const created = await api.post<InternalUser>("/internal-users", {
      email: "nour.salem@shiptrack.example",
      password: "password123",
      name: "Nour Salem",
      roleName: "driver",
    });
    await api.patch(`/internal-users/${hiba.id}`, { roleName: "dispatcher" });
    await api.patch(`/internal-users/${created.id}`, { isActive: false });
    await api.patch(`/internal-users/${created.id}`, {});

    await signInAs(youssef.email);
    expect(await newest("STAFF_ACCOUNT_CREATED")).toMatchObject({ payload: { internalUserId: created.id, name: "Nour Salem" } });
    expect(await newest("STAFF_ACCOUNT_UPDATED")).toMatchObject({
      title: "Staff account updated",
      payload: { internalUserId: hiba.id, changed: ["role"], roleName: "dispatcher" },
    });
    expect(await newest("STAFF_ACCOUNT_DEACTIVATED")).toMatchObject({ payload: { internalUserId: created.id } });

    await signInAs(hiba.email);
    expect(await newest("STAFF_ACCOUNT_UPDATED")).toMatchObject({ title: "Your account was updated" });
    await expect(signInAs(created.email)).rejects.toMatchObject({ status: 401 });
  });

  it("contacts: a request reaches the addressee, an acceptance the requester; a block or removal only the one who did it", async () => {
    await signInAs(rami.email);
    const contact = await api.post<Contact>("/contacts", { addresseeId: youssef.id });
    await signInAs(youssef.email);
    expect(await newest("CONTACT_REQUEST_RECEIVED")).toMatchObject({
      message: "Rami Khoury wants to add you as a contact.",
      payload: { contactId: contact.id, internalUserId: rami.id },
    });
    await api.patch(`/contacts/${contact.id}/accept`);
    await api.patch(`/contacts/${contact.id}/block`);

    expect(await newest("CONTACT_BLOCKED")).toMatchObject({ ownAction: true, message: "You blocked Rami Khoury." });

    await signInAs(rami.email);
    expect(await newest("CONTACT_REQUEST_ACCEPTED")).toMatchObject({ payload: { contactId: contact.id, name: "Youssef Benali" } });
    const ramiCount = (await all()).length;
    await signInAs(youssef.email);
    await api.delete(`/contacts/${contact.id}`);
    expect(await newest("CONTACT_REMOVED")).toMatchObject({ ownAction: true, payload: { internalUserId: rami.id } });
    await signInAs(rami.email);
    expect((await all()).length).toBe(ramiCount);
    expect(await countOf("CONTACT_BLOCKED")).toBe(0);
  });

  it("passwords: the owner hears about it, even when they changed it themselves", async () => {
    await signInAs(maya.email);
    const before = await countOf("PASSWORD_CHANGED");
    await api.post("/staff-auth/change-password", { currentPassword: MOCK_STAFF_PASSWORD, newPassword: "a-new-password" });
    expect(await countOf("PASSWORD_CHANGED")).toBe(before + 1);
    expect(await newest("PASSWORD_CHANGED")).toMatchObject({ title: "Password changed", payload: {}, readAt: null });

    tokens.clear();
    await api.post("/auth/reset-password", { token: "mock-reset-token", newPassword: "another-one" }, { auth: false });
    await signInAsAmina();
    expect(await newest("PASSWORD_CHANGED")).toMatchObject({ title: "Password changed" });
  });

  it("a file the admin attaches to Amina's shipment reaches Amina, worded by kind", async () => {
    await signInAs(nadia.email);
    const { items } = await api.getPage<AdminShipment>("/admin/shipments", { query: { limit: 100 } });
    const trackingId = items.find((row) => row.client.id === MOCK_USER.id && row.status === "delivered")!.trackingId;
    const form = new FormData();
    form.set("kind", "other");
    form.set("file", new File(["%PDF-1.4"], "customs.pdf", { type: "application/pdf" }));
    await api.post(`/admin/shipments/${trackingId}/files`, form);

    await signInAsAmina();
    expect(await newest("SHIPMENT_FILE_ADDED")).toMatchObject({
      title: "New document",
      message: `customs.pdf was added to ${trackingId}.`,
      payload: { trackingId, kind: "other", fileName: "customs.pdf" },
    });
  });

  it("reopening an existing support conversation tells nobody again", async () => {
    const zineb = staffNamed("Zineb Idrissi"); // support
    await signInAs(zineb.email);
    const before = await countOf("SUPPORT_CONVERSATION_STARTED");
    expect(before).toBeGreaterThan(0);
    await signInAsAmina();
    await api.post("/chat/support");
    await signInAs(zineb.email);
    expect(await countOf("SUPPORT_CONVERSATION_STARTED")).toBe(before);
  });
});

describe("notifications: live, over the mock socket", () => {
  it("pushes a new notification to its recipient's tab as notification.new, and no one else's", async () => {
    await signInAs(nadia.email);
    const connection = createMockChatConnection();
    const received: AppNotification[] = [];
    connection.on("notification.new", (notification) => received.push(notification));
    connection.connect();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const owner = { id: nadia.id, accountType: "staff" as const };
    notifyAction({ type: "SESSIONS_REVOKED", account: owner }, owner);
    const other = { id: maya.id, accountType: "staff" as const };
    notifyAction({ type: "SESSIONS_REVOKED", account: other }, other);
    connection.close();

    expect(received).toEqual([
      expect.objectContaining({ type: "SESSIONS_REVOKED", title: "Signed out everywhere", ownAction: false }),
    ]);
  });
});
