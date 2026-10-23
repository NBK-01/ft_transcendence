import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api, configureApi } from "./client";
import { ApiError } from "./errors";
import { handlers, ok, paginated } from "./mocks/handlers";
import { internalUsers, MOCK_STAFF_PASSWORD, ORGANIZATIONS, staffPasswords } from "./mocks/data";
import { roleCan } from "./permissions";
import { tokens } from "./session";
import type { AuthResponse, Contact, InternalUser, StaffAuthResponse, User } from "./types";

// Same handlers the dev app uses — tests and mocks can't drift apart.
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

const onSessionExpired = vi.fn();

beforeAll(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  configureApi({ baseUrl: "http://api.test/api", getLanguage: () => "fr", onSessionExpired });
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  tokens.clear();
  onSessionExpired.mockClear();
});
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());

/** Counts refresh calls while keeping the real mock behaviour. */
function countRefreshes() {
  let count = 0;
  server.events.on("request:start", ({ request }) => {
    if (request.url.endsWith("/auth/refresh")) count += 1;
  });
  return () => count;
}

describe("api client", () => {
  it("sends the Bearer token and Accept-Language", async () => {
    let seen: Headers | undefined;
    server.use(
      http.get("*/api/echo", ({ request }) => {
        seen = request.headers;
        return HttpResponse.json({ ok: true });
      }),
    );
    tokens.set({ accessToken: "mock-access-x", refreshToken: "mock-refresh-x" });

    await api.get("/echo");

    expect(seen?.get("Authorization")).toBe("Bearer mock-access-x");
    expect(seen?.get("Accept-Language")).toBe("fr");
  });

  it("after a reload (no access token), refreshes first instead of sending a doomed request", async () => {
    localStorage.setItem("trans-refresh-token", "mock-refresh-1");
    const refreshes = countRefreshes();

    const me = await api.get<User>("/auth/me");

    expect(me.email).toBe("amina@example.com");
    expect(refreshes()).toBe(1);
  });

  it("on concurrent 401s, refreshes once and retries every request", async () => {
    tokens.set({ accessToken: "stale-token", refreshToken: "mock-refresh-1" });
    const refreshes = countRefreshes();

    const results = await Promise.all([api.get<User>("/auth/me"), api.get<User>("/auth/me"), api.get<User>("/auth/me")]);

    expect(results.map((user) => user.name)).toEqual(Array(3).fill("Amina El Idrissi"));
    expect(refreshes()).toBe(1);
    expect(tokens.getAccess()).toMatch(/^mock-access-/);
  });

  it("when refresh fails, clears the session and reports it", async () => {
    tokens.set({ accessToken: "stale-token", refreshToken: "revoked-token" });

    await expect(api.get("/auth/me")).rejects.toMatchObject({ status: 401 });

    expect(tokens.hasSession()).toBe(false);
    expect(onSessionExpired).toHaveBeenCalledOnce();
  });

  it("turns backend error bodies into ApiError with errorCode", async () => {
    const error = await api
      .post("/auth/login", { email: "amina@example.com", password: "wrong" }, { auth: false })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: "http", status: 401, errorCode: 2002, isClientError: true });
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("reports network failures as kind 'network'", async () => {
    server.use(http.get("*/api/down", () => HttpResponse.error()));

    await expect(api.get("/down", { auth: false })).rejects.toMatchObject({ kind: "network", status: 0 });
  });

  it("unwraps the backend's success envelope", async () => {
    server.use(http.get("*/api/thing", () => ok({ id: "t1", name: "Thing" })));

    await expect(api.get("/thing", { auth: false })).resolves.toEqual({ id: "t1", name: "Thing" });
  });

  it("unwraps POST responses with their real status code", async () => {
    server.use(http.post("*/api/things", () => ok({ id: "t2" }, 201)));

    await expect(api.post("/things", { name: "New" }, { auth: false })).resolves.toEqual({ id: "t2" });
  });

  it("passes non-enveloped bodies through unchanged", async () => {
    server.use(http.get("*/api/plain", () => HttpResponse.json({ success: false, data: 1 })));

    await expect(api.get("/plain", { auth: false })).resolves.toEqual({ success: false, data: 1 });
  });

  it("getPage returns the items and pagination meta", async () => {
    const all = Array.from({ length: 45 }, (_, index) => ({ id: index + 1 }));
    server.use(http.get("*/api/list", () => paginated(all, 3, 20)));

    const page = await api.getPage<{ id: number }>("/list", { auth: false });

    expect(page.items.map((item) => item.id)).toEqual([41, 42, 43, 44, 45]);
    expect(page.meta).toEqual({ page: 3, limit: 20, totalItems: 45, totalPages: 3 });
  });

  it("getPage treats an unpaginated list as a single page", async () => {
    server.use(http.get("*/api/all", () => ok([{ id: 1 }, { id: 2 }])));

    const page = await api.getPage<{ id: number }>("/all", { auth: false });

    expect(page.items).toHaveLength(2);
    expect(page.meta).toEqual({ page: 1, limit: 2, totalItems: 2, totalPages: 1 });
  });

  it("drops empty query params", async () => {
    let url = "";
    server.use(
      http.get("*/api/shipments", ({ request }) => {
        url = request.url;
        return HttpResponse.json([]);
      }),
    );

    await api.get("/shipments", { auth: false, query: { status: "in_transit", q: "", page: 2, branch: undefined } });

    expect(new URL(url).search).toBe("?status=in_transit&page=2");
  });
});

/** Signs in as a mock staff account (an admin by default) and starts the session. */
async function signInAsStaff(email = internalUsers[0]!.email) {
  const { user, ...pair } = await staffLogin(email);
  tokens.set(pair, user);
  return { user, ...pair };
}
const staffLogin = (email: string, password = MOCK_STAFF_PASSWORD) =>
  api.post<StaffAuthResponse>("/staff-auth/login", { email, password }, { auth: false });

// The mocks stand in for the backend, so they must answer like it does.
describe("mocks match the backend", () => {
  beforeEach(() => signInAsStaff());
  const staff = (body: object) => api.post<InternalUser>("/internal-users", body);
  const valid = { email: "new.dispatcher@example.com", password: "password1", name: "New Dispatcher", roleName: "dispatcher" };

  it("login returns only id, email and name; /auth/me has the full user", async () => {
    const session = await api.post<AuthResponse>("/auth/login", { email: "a@example.com", password: "secret" }, { auth: false });
    expect(Object.keys(session.user).sort()).toEqual(["email", "id", "name"]);

    tokens.set(session);
    const me = await api.get<User>("/auth/me");
    expect(me).toHaveProperty("isVerified");
  });

  it("an unknown role is 404 with code 7004, on create and update", async () => {
    await expect(staff({ ...valid, roleName: "pilot" })).rejects.toMatchObject({ status: 404, errorCode: 7004 });

    const existing = internalUsers[0]!;
    await expect(
      api.patch(`/internal-users/${existing.id}`, { roleName: "pilot" }),
    ).rejects.toMatchObject({ status: 404, errorCode: 7004 });
  });

  it("a taken email wins over an unknown role (409 first, like the service)", async () => {
    const taken = internalUsers[0]!.email;
    await expect(staff({ ...valid, email: taken, roleName: "pilot" })).rejects.toMatchObject({ status: 409, errorCode: 8002 });
  });

  it("doesn't check that the branch exists", async () => {
    const user = await staff({ ...valid, organizationId: "00000000-0000-4000-8000-0000000000ff" });
    expect(user.organizationId).toBe("00000000-0000-4000-8000-0000000000ff");
  });
});

describe("staff sign-in", () => {
  afterEach(() => configureApi({ refreshPath: "/auth/refresh", storageKey: "trans-refresh-token" }));

  it("staff endpoints answer 401 without a staff token", async () => {
    for (const path of ["/internal-users", "/organizations", "/access-control/roles"]) {
      await expect(api.get(path, { auth: false })).rejects.toMatchObject({ status: 401, errorCode: undefined });
    }
    await signInAsStaff();
    await expect(api.get("/internal-users")).resolves.toBeInstanceOf(Array);
  });

  it("login returns the staff member with their role; the email is matched case-insensitively", async () => {
    const admin = internalUsers[0]!;
    const { user } = await staffLogin(`  ${admin.email.toUpperCase()} `);
    expect(user).toEqual({ id: admin.id, email: admin.email, name: admin.name, roleName: admin.roleName });
  });

  it("a wrong password or unknown email is 8003, a deactivated account 7003", async () => {
    await expect(staffLogin(internalUsers[0]!.email, "wrong")).rejects.toMatchObject({ status: 401, errorCode: 8003 });
    await expect(staffLogin("nobody@shiptrack.example")).rejects.toMatchObject({ status: 401, errorCode: 8003 });
    const inactive = internalUsers.find((user) => !user.isActive)!;
    await expect(staffLogin(inactive.email)).rejects.toMatchObject({ status: 401, errorCode: 7003 });
  });

  it("refreshes through the configured path, and the old refresh token stops working", async () => {
    configureApi({ refreshPath: "/staff-auth/refresh" });
    const { refreshToken } = await signInAsStaff();
    tokens.set({ accessToken: "expired", refreshToken });
    const paths: string[] = [];
    server.events.on("request:start", ({ request }) => void paths.push(new URL(request.url).pathname));

    await api.get("/internal-users");

    expect(paths).toContain("/api/staff-auth/refresh");
    expect(paths).not.toContain("/api/auth/refresh");
    await expect(
      api.post("/staff-auth/refresh", { refreshToken }, { auth: false }),
    ).rejects.toMatchObject({ status: 401, errorCode: 8004 });
  });

  it("logout revokes that refresh token; logout-all revokes every session", async () => {
    const first = await staffLogin(internalUsers[0]!.email);
    await api.post("/staff-auth/logout", { refreshToken: first.refreshToken }, { auth: false });
    await expect(
      api.post("/staff-auth/refresh", { refreshToken: first.refreshToken }, { auth: false }),
    ).rejects.toMatchObject({ errorCode: 8004 });

    const other = await staffLogin(internalUsers[0]!.email);
    await signInAsStaff();
    await api.post("/staff-auth/logout-all");
    await expect(
      api.post("/staff-auth/refresh", { refreshToken: other.refreshToken }, { auth: false }),
    ).rejects.toMatchObject({ errorCode: 8004 });
  });

  it("each storage key holds its own session, with the user next to it", async () => {
    configureApi({ storageKey: "trans-staff-refresh-token" });
    const { user, refreshToken } = await signInAsStaff();

    expect(localStorage.getItem("trans-staff-refresh-token")).toBe(refreshToken);
    expect(localStorage.getItem("trans-refresh-token")).toBeNull();
    expect(tokens.getUser()).toEqual(user);
    // Same object until it changes, as useSyncExternalStore needs.
    expect(tokens.getUser()).toBe(tokens.getUser());

    tokens.clear();
    expect(localStorage.getItem("trans-staff-refresh-token")).toBeNull();
    expect(tokens.getUser()).toBeNull();
  });
});

describe("roles and permissions", () => {
  const dispatcher = internalUsers.find((user) => user.roleName === "dispatcher" && user.isActive)!;
  const branch = ORGANIZATIONS[0]!;
  const forbidden = { status: 403, errorCode: 7001 };

  it("roleCan follows the backend's table; no role, or an unknown one, has nothing", () => {
    expect(roleCan("admin", "organizations:manage")).toBe(true);
    expect(roleCan("dispatcher", "organizations:manage")).toBe(false);
    expect(roleCan("dispatcher", "organizations:read")).toBe(true);
    expect(roleCan("driver", "shipments:assign")).toBe(false);
    expect(roleCan("support", "chat:support:access")).toBe(true);
    expect(roleCan("dispatcher", "chat:support:access")).toBe(false);
    expect(roleCan(null, "organizations:read")).toBe(false);
    expect(roleCan("toString", "organizations:read")).toBe(false);
  });

  it("a dispatcher reads branches but gets 403 (7001) on staff, roles and branch changes", async () => {
    await signInAsStaff(dispatcher.email);

    await expect(api.get("/organizations")).resolves.toBeInstanceOf(Array);
    await expect(api.get(`/organizations/${branch.id}`)).resolves.toMatchObject({ id: branch.id });
    await expect(api.get(`/organizations/${branch.id}/staff`)).resolves.toBeInstanceOf(Array);

    await expect(api.get("/internal-users")).rejects.toMatchObject(forbidden);
    await expect(api.get("/access-control/roles")).rejects.toMatchObject(forbidden);
    await expect(api.post("/organizations", { name: "Tangier Port" })).rejects.toMatchObject(forbidden);
    await expect(api.patch(`/organizations/${branch.id}`, { name: "Renamed" })).rejects.toMatchObject(forbidden);
    await expect(api.delete(`/organizations/${branch.id}`)).rejects.toMatchObject(forbidden);
    await expect(api.post(`/organizations/${branch.id}/staff/${dispatcher.id}`)).rejects.toMatchObject(forbidden);
  });

  it("checks the role as it is now, not as it was when the token was issued", async () => {
    const own = await staffLogin(dispatcher.email);
    await signInAsStaff();
    await api.patch(`/internal-users/${dispatcher.id}`, { roleName: "admin" });

    tokens.set(own, own.user);
    await expect(api.get("/internal-users")).resolves.toBeInstanceOf(Array);

    await signInAsStaff();
    await api.patch(`/internal-users/${dispatcher.id}`, { roleName: "dispatcher" });
  });

  it("an account deactivated mid-session gets 401 (7003)", async () => {
    const own = await staffLogin(dispatcher.email);
    await signInAsStaff();
    await api.patch(`/internal-users/${dispatcher.id}`, { isActive: false });

    tokens.set(own, own.user);
    onSessionExpired.mockClear();
    await expect(api.get("/organizations")).rejects.toMatchObject({ status: 401, errorCode: 7003 });
    // Unlike other coded 401s, this one ends the session.
    expect(tokens.hasSession()).toBe(false);
    expect(onSessionExpired).toHaveBeenCalledOnce();

    await signInAsStaff();
    await api.patch(`/internal-users/${dispatcher.id}`, { isActive: true });
  });
});

describe("change password", () => {
  const account = internalUsers.find((user) => user.roleName === "support" && user.isActive)!;
  afterEach(() => void staffPasswords.set(account.id, MOCK_STAFF_PASSWORD));

  it("a wrong current password is 401 (8003) and keeps the session: no refresh, no sign-out", async () => {
    await signInAsStaff(account.email);
    const refreshes = countRefreshes();

    await expect(
      api.post("/staff-auth/change-password", { currentPassword: "wrong", newPassword: "newpass123" }),
    ).rejects.toMatchObject({ status: 401, errorCode: 8003 });

    expect(refreshes()).toBe(0);
    expect(tokens.hasSession()).toBe(true);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("a new password under 8 characters is 400", async () => {
    await signInAsStaff(account.email);
    await expect(
      api.post("/staff-auth/change-password", { currentPassword: MOCK_STAFF_PASSWORD, newPassword: "short" }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("after a change, the new password signs in and the old one doesn't", async () => {
    await signInAsStaff(account.email);
    await api.post("/staff-auth/change-password", { currentPassword: MOCK_STAFF_PASSWORD, newPassword: "newpass123" });

    await expect(staffLogin(account.email, "newpass123")).resolves.toHaveProperty("accessToken");
    await expect(staffLogin(account.email)).rejects.toMatchObject({ errorCode: 8003 });
  });
});

describe("contacts", () => {
  const staffNamed = (name: string) => internalUsers.find((user) => user.name === name)!;
  const rami = staffNamed("Rami Khoury"); // dispatcher, Beirut
  const youssef = staffNamed("Youssef Benali"); // admin, no branch
  const omar = staffNamed("Omar Fassi"); // driver, Casablanca
  const karim = staffNamed("Karim Saade"); // driver, Beirut: his request to Rami is pending
  const list = (status?: string) => api.get<Contact[]>("/contacts", { query: { status } });
  const request = (addresseeId: string) => api.post<Contact>("/contacts", { addresseeId });

  it("needs a staff token, and lists only your own contacts, by status", async () => {
    await expect(api.get("/contacts", { auth: false })).rejects.toMatchObject({ status: 401 });

    await signInAsStaff(rami.email);
    const all = await list();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((contact) => contact.requesterId === rami.id || contact.addresseeId === rami.id)).toBe(true);
    expect((await list("pending")).every((contact) => contact.status === "pending")).toBe(true);
    await expect(list("friends")).rejects.toMatchObject({ status: 400 });
  });

  it("adding: your own branch or an admin; not yourself, not someone already connected", async () => {
    await signInAsStaff(rami.email);
    await expect(request(omar.id)).rejects.toMatchObject({ status: 403, errorCode: 10003 });
    await expect(request(rami.id)).rejects.toMatchObject({ status: 400, errorCode: 10004 });
    await expect(request(karim.id)).rejects.toMatchObject({ status: 409, errorCode: 10002 });

    const sent = await request(youssef.id);
    expect(sent).toMatchObject({ status: "pending", requesterName: rami.name, addresseeName: youssef.name });
    await api.delete(`/contacts/${sent.id}`);
  });

  it("only the addressee accepts; accepting twice is 409 (10005)", async () => {
    await signInAsStaff(rami.email);
    const sent = await request(youssef.id);
    await expect(api.patch(`/contacts/${sent.id}/accept`)).rejects.toMatchObject({ status: 404, errorCode: 10001 });

    await signInAsStaff(youssef.email);
    await expect(api.patch<Contact>(`/contacts/${sent.id}/accept`)).resolves.toMatchObject({ status: "accepted" });
    await expect(api.patch(`/contacts/${sent.id}/accept`)).rejects.toMatchObject({ status: 409, errorCode: 10005 });
    await api.delete(`/contacts/${sent.id}`);
  });

  it("rejecting deletes the request", async () => {
    await signInAsStaff(rami.email);
    const sent = await request(youssef.id);

    await signInAsStaff(youssef.email);
    await api.patch(`/contacts/${sent.id}/reject`);
    expect((await list()).some((contact) => contact.id === sent.id)).toBe(false);
    await expect(api.patch(`/contacts/${sent.id}/reject`)).rejects.toMatchObject({ status: 404 });
  });

  it("either side blocks or removes; someone else gets 404", async () => {
    await signInAsStaff(rami.email);
    const sent = await request(youssef.id);
    await expect(api.patch<Contact>(`/contacts/${sent.id}/block`)).resolves.toMatchObject({ status: "blocked" });

    await signInAsStaff(); // Nadia: not a party
    await expect(api.delete(`/contacts/${sent.id}`)).rejects.toMatchObject({ status: 404, errorCode: 10001 });

    await signInAsStaff(youssef.email);
    await api.delete(`/contacts/${sent.id}`);
    expect((await list()).some((contact) => contact.id === sent.id)).toBe(false);
  });
});
