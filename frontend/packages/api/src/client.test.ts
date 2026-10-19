import { http, HttpResponse } from "msw/http";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api, configureApi } from "./client";
import { ApiError } from "./errors";
import { handlers, ok, paginated } from "./mocks/handlers";
import { internalUsers } from "./mocks/data";
import { tokens } from "./session";
import type { AuthResponse, InternalUser, User } from "./types";

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

// The mocks stand in for the backend, so they must answer like it does.
describe("mocks match the backend", () => {
  const staff = (body: object) => api.post<InternalUser>("/internal-users", body, { auth: false });
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
      api.patch(`/internal-users/${existing.id}`, { roleName: "pilot" }, { auth: false }),
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
