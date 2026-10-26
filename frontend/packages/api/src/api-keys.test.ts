import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { API_KEY_BRANCH_INACTIVE, API_KEY_NOT_FOUND } from "./api-keys";
import { api, configureApi } from "./client";
import { internalUsers, MOCK_STAFF_PASSWORD, ORGANIZATIONS } from "./mocks/data";
import { handlers } from "./mocks/handlers";
import { tokens } from "./session";
import type { ApiKey, AppNotification, CreatedApiKey, StaffAuthResponse } from "./types";

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

async function signInAs(email: string) {
  const { user, ...pair } = await api.post<StaffAuthResponse>(
    "/staff-auth/login",
    { email, password: MOCK_STAFF_PASSWORD },
    { auth: false },
  );
  tokens.set(pair, user);
}

const activeBranch = () => ORGANIZATIONS.find((org) => org.isActive)!;
const inactiveBranch = () => ORGANIZATIONS.find((org) => !org.isActive);

const create = (name: string, organizationId = activeBranch().id) =>
  api.post<CreatedApiKey>("/api-keys", { name, organizationId });

const notificationsOfType = async (type: AppNotification["type"]) =>
  (await api.getPage<AppNotification>("/notifications", { query: { type, limit: 100 } })).items;

describe("API key mocks match the backend", () => {
  it("are for admins only: support gets 403 (7001)", async () => {
    await signInAs(maya.email);
    await expect(api.get("/api-keys")).rejects.toMatchObject({ status: 403, errorCode: 7001 });
    await expect(create("Nope")).rejects.toMatchObject({ status: 403 });
  });

  it("create returns the full key once; the list only ever shows it masked", async () => {
    await signInAs(nadia.email);
    const created = await create("  Carrier sync  ");

    expect(created.key).toMatch(/^stk_[0-9a-f]{64}$/);
    expect(created).toMatchObject({
      name: "Carrier sync",
      maskedKey: `${created.key.slice(0, 8)}…${created.key.slice(-4)}`,
      organization: { id: activeBranch().id },
      createdBy: { id: nadia.id },
      lastUsedAt: null,
      revokedAt: null,
    });

    const list = await api.get<ApiKey[]>("/api-keys");
    expect(list[0]?.id).toBe(created.id);
    expect(JSON.stringify(list)).not.toContain(created.key);
  });

  it("filters by branch, newest first", async () => {
    await signInAs(nadia.email);
    const branch = activeBranch();
    const list = await api.get<ApiKey[]>("/api-keys", { query: { organizationId: branch.id } });
    expect(list.every((key) => key.organization.id === branch.id)).toBe(true);
    const dates = list.map((key) => key.createdAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it("refuses a bad body (400), an unknown branch (404, 4001) and an inactive one (400, 16002)", async () => {
    await signInAs(nadia.email);
    await expect(create("   ")).rejects.toMatchObject({ status: 400 });
    await expect(create("x", "not-a-uuid")).rejects.toMatchObject({ status: 400 });
    await expect(create("x", "00000000-0000-4000-a000-0000000000ff")).rejects.toMatchObject({
      status: 404,
      errorCode: 4001,
    });
    const inactive = inactiveBranch();
    if (inactive) {
      await expect(create("x", inactive.id)).rejects.toMatchObject({
        status: 400,
        errorCode: API_KEY_BRANCH_INACTIVE,
      });
    }
  });

  it("revoke is idempotent: the first date stays; an unknown id is 404 (16001)", async () => {
    await signInAs(nadia.email);
    const created = await create("To revoke");
    const first = await api.delete<ApiKey>(`/api-keys/${created.id}`);
    expect(first.revokedAt).not.toBeNull();
    const again = await api.delete<ApiKey>(`/api-keys/${created.id}`);
    expect(again.revokedAt).toBe(first.revokedAt);

    await expect(api.delete("/api-keys/00000000-0000-4000-a000-0000000000ff")).rejects.toMatchObject({
      status: 404,
      errorCode: API_KEY_NOT_FOUND,
    });
  });

  it("tells the other admins (not the one who acted), once per create and per revoke", async () => {
    await signInAs(nadia.email);
    const created = await create("Notified key");
    await api.delete(`/api-keys/${created.id}`);
    await api.delete(`/api-keys/${created.id}`);
    const nadiaSees = (await notificationsOfType("API_KEY_CREATED")).filter(
      (n) => n.type === "API_KEY_CREATED" && n.payload.apiKeyId === created.id,
    );
    expect(nadiaSees).toEqual([]);

    await signInAs(youssef.email);
    const about = (list: AppNotification[]) =>
      list.filter((n) => (n.type === "API_KEY_CREATED" || n.type === "API_KEY_REVOKED") && n.payload.apiKeyId === created.id);
    const createdNotices = about(await notificationsOfType("API_KEY_CREATED"));
    const revokedNotices = about(await notificationsOfType("API_KEY_REVOKED"));
    expect(createdNotices).toHaveLength(1);
    expect(revokedNotices).toHaveLength(1);
    expect(createdNotices[0]).toMatchObject({
      title: "New API key",
      payload: { name: "Notified key", maskedKey: created.maskedKey },
    });
    expect(JSON.stringify(createdNotices)).not.toContain(created.key);
  });
});

