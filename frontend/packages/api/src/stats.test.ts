import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api, configureApi, type Query } from "./client";
import { internalUsers, MOCK_STAFF_PASSWORD, ORGANIZATIONS } from "./mocks/data";
import { handlers } from "./mocks/handlers";
import { tokens } from "./session";
import type { AdminShipment, AdminShipmentDetail, OverviewStats, ShipmentState, StaffAuthResponse } from "./types";

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
const maya = staffNamed("Maya Azar"); // support: reads shipments
const rami = staffNamed("Rami Khoury"); // dispatcher: can't read them

async function signInAs(email = nadia.email) {
  const { user, ...pair } = await api.post<StaffAuthResponse>(
    "/staff-auth/login",
    { email, password: MOCK_STAFF_PASSWORD },
    { auth: false },
  );
  tokens.set(pair, user);
}

/** Today in the test's time zone, like the overview asks for it. */
function today() {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

const overview = (query: Query = today()) => api.get<OverviewStats>("/admin/stats/overview", { query });
const list = (query: Query = {}) => api.getPage<AdminShipment>("/admin/shipments", { query: { limit: 100, ...query } });
const badRequest = { status: 400, errorCode: undefined, messages: expect.arrayContaining([expect.any(String)]) };

describe("admin stats: access", () => {
  it("needs a staff token; support reads it, a dispatcher can't (403, 7001)", async () => {
    await expect(overview()).rejects.toMatchObject({ status: 401 });
    await signInAs(maya.email);
    await expect(overview()).resolves.toMatchObject({ byStatus: expect.any(Object) });
    await signInAs(rami.email);
    await expect(overview()).rejects.toMatchObject({ status: 403, errorCode: 7001 });
  });

  it("refuses a bad period, a bad branch or an unknown field with a 400", async () => {
    await signInAs();
    const { from, to } = today();
    for (const query of [
      {},
      { from: "yesterday", to },
      { from: to, to: from },
      { from, to: from },
      { from: "2025-10-01T00:00:00Z", to: "2026-10-03T00:00:00Z" },
      { from, to, organizationId: "beirut" },
      { from, to, status: "delivered" },
    ]) {
      await expect(overview(query)).rejects.toMatchObject(badRequest);
    }
    await expect(overview({ from: "2025-10-01T00:00:00Z", to: "2026-10-02T00:00:00Z" })).resolves.toBeDefined();
  });
});

describe("admin stats: the numbers", () => {
  beforeEach(() => signInAs());

  it("counts every status, as the shipments list does", async () => {
    const stats = await overview();
    expect(Object.keys(stats.byStatus)).toHaveLength(10);
    for (const [status, count] of Object.entries(stats.byStatus) as [ShipmentState, number][]) {
      expect(count).toBe((await list({ status, limit: 1 })).meta.totalItems);
    }
  });

  it("counts what was created today and yesterday, and gives the periods it used", async () => {
    const period = today();
    const stats = await overview(period);
    const { items } = await list();
    const from = Date.parse(period.from);
    const to = Date.parse(period.to);
    const createdIn = (start: number, end: number) =>
      items.filter((row) => Date.parse(row.createdAt) >= start && Date.parse(row.createdAt) < end).length;

    expect(stats.created).toEqual({ current: createdIn(from, to), previous: createdIn(2 * from - to, from) });
    expect(stats.created.current).toBeGreaterThan(0);
    expect(stats.delivered.current).toBeGreaterThan(0);
    expect(stats.period).toEqual({
      from: new Date(from).toISOString(),
      to: new Date(to).toISOString(),
      previousFrom: new Date(2 * from - to).toISOString(),
    });
  });

  it("lists the 10 latest events, newest first, with who did each", async () => {
    const { recentActivity } = await overview();
    expect(recentActivity).toHaveLength(10);
    const times = recentActivity.map((activity) => activity.occurredAt);
    expect(times.every((time, index) => index === 0 || times[index - 1]! >= time)).toBe(true);
    for (const { actor } of recentActivity) {
      expect(["customer", "staff", "partner", "carrier"]).toContain(actor!.type);
      if (actor!.type === "partner") expect(actor!.organization).toEqual({ id: expect.any(String), name: expect.any(String) });
      if (actor!.type === "carrier") expect(actor).toMatchObject({ id: null, name: null });
    }
  });

  it("follows a status change: the new step comes first, by whoever posted it", async () => {
    const before = await overview();
    const confirmed = (await list({ status: "confirmed" })).items.find((row) => row.organization === null)!;
    const moved = await api.post<AdminShipmentDetail>(`/admin/shipments/${confirmed.trackingId}/events`, {
      status: "in_transit",
      location: "Lyon hub",
    });
    expect(moved.status).toBe("in_transit");

    const after = await overview();
    expect(after.byStatus.confirmed).toBe(before.byStatus.confirmed - 1);
    expect(after.byStatus.in_transit).toBe(before.byStatus.in_transit + 1);
    expect(after.recentActivity[0]).toMatchObject({
      trackingId: confirmed.trackingId,
      status: "in_transit",
      location: "Lyon hub",
      actor: { type: "staff", id: nadia.id, name: nadia.name, organization: null },
    });
  });
});

describe("admin stats: one branch", () => {
  beforeEach(() => signInAs());

  it("counts only the branch's shipments, and its events", async () => {
    const beirut = ORGANIZATIONS[0]!;
    const own = await list({ organizationId: beirut.id });
    const stats = await overview({ ...today(), organizationId: beirut.id });

    const total = Object.values(stats.byStatus).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(own.meta.totalItems);
    const ids = new Set(own.items.map((row) => row.trackingId));
    expect(stats.recentActivity.length).toBeGreaterThan(0);
    expect(stats.recentActivity.every((activity) => ids.has(activity.trackingId))).toBe(true);

    const empty = await overview({ ...today(), organizationId: ORGANIZATIONS[4]!.id });
    expect(empty).toMatchObject({ created: { current: 0, previous: 0 }, delivered: { current: 0, previous: 0 }, recentActivity: [] });
  });
});
