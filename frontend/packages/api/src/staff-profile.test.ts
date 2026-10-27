import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { api, configureApi } from "./client";
import { internalUsers, MOCK_STAFF_PASSWORD, MOCK_USER } from "./mocks/data";
import { handlers } from "./mocks/handlers";
import { tokens } from "./session";
import type {
  AuthResponse,
  ContactPresence,
  StaffAuthResponse,
  StaffAvatarResult,
  StaffMe,
  StaffProfile,
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
const nadia = staffNamed("Nadia Haddad"); // admin, no branch
const rami = staffNamed("Rami Khoury"); // dispatcher, Beirut Central
const maya = staffNamed("Maya Azar"); // support, asked Nadia (pending)

async function signInAs(email: string) {
  const { user, ...pair } = await api.post<StaffAuthResponse>(
    "/staff-auth/login",
    { email, password: MOCK_STAFF_PASSWORD },
    { auth: false },
  );
  tokens.set(pair, user);
}

const me = () => api.get<StaffMe>("/staff-auth/me");
const photo = (type = "image/png", size = 1024) => {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(size)], "me.png", { type }));
  return form;
};

describe("staff profile mocks match the backend", () => {
  it("GET /staff-auth/me: the account with its branch, permissions and photo", async () => {
    await signInAs(rami.email);

    await expect(me()).resolves.toMatchObject({
      id: rami.id,
      roleName: "dispatcher",
      organization: { name: "Beirut Central", isActive: true },
      avatarUrl: null,
      permissions: expect.arrayContaining(["shipments:read:org"]),
    });
  });

  it("PATCH /staff-profile: your own name, trimmed; anything else, or nothing, is a 400", async () => {
    await signInAs(rami.email);

    await expect(api.patch<StaffMe>("/staff-profile", { name: "  Rami K.  " })).resolves.toMatchObject({ name: "Rami K." });
    await expect(me()).resolves.toMatchObject({ name: "Rami K." });
    for (const body of [{ name: "  " }, { name: "x".repeat(101) }, { name: "Rami", roleName: "admin" }]) {
      await expect(api.patch("/staff-profile", body)).rejects.toMatchObject({ status: 400 });
    }
  });

  it("the photo: JPEG/PNG/WebP up to 2 MB (9001, 9002); shown on /me and your page; removed back to initials", async () => {
    await signInAs(rami.email);

    await expect(api.post("/staff-profile/avatar", photo("image/gif"))).rejects.toMatchObject({ status: 400, errorCode: 9001 });
    await expect(api.post("/staff-profile/avatar", photo("image/png", 3 * 1024 * 1024))).rejects.toMatchObject({
      status: 400,
      errorCode: 9002,
    });
    const { avatarUrl } = await api.post<StaffAvatarResult>("/staff-profile/avatar", photo());
    expect(avatarUrl).toEqual(expect.any(String));
    await expect(me()).resolves.toMatchObject({ avatarUrl });

    await signInAs(nadia.email);
    await expect(api.get<StaffProfile>(`/staff-profile/${rami.id}`)).resolves.toMatchObject({ avatarUrl });

    await signInAs(rami.email);
    await expect(api.delete<StaffAvatarResult>("/staff-profile/avatar")).resolves.toEqual({ avatarUrl: null });
    await expect(me()).resolves.toMatchObject({ avatarUrl: null });
  });

  it("GET /staff-profile/:id: any staff member sees a colleague; 404 (8001) unknown, 400 not a UUID", async () => {
    await signInAs(rami.email);

    await expect(api.get<StaffProfile>(`/staff-profile/${nadia.id}`)).resolves.toMatchObject({
      id: nadia.id,
      name: "Nadia Haddad",
      roleName: "admin",
      organization: null,
    });
    await expect(api.get("/staff-profile/00000000-0000-4000-a000-0000000000ff")).rejects.toMatchObject({
      status: 404,
      errorCode: 8001,
    });
    await expect(api.get("/staff-profile/nadia")).rejects.toMatchObject({ status: 400 });
  });

  it("a customer token gets a 403 (7002)", async () => {
    tokens.set(await api.post<AuthResponse>("/auth/login", { email: MOCK_USER.email, password: "x" }, { auth: false }));

    await expect(api.get(`/staff-profile/${nadia.id}`)).rejects.toMatchObject({ status: 403, errorCode: 7002 });
  });
});

describe("presence mocks match the backend", () => {
  it("GET /contacts/presence: each accepted contact, online or not; pending ones aren't listed", async () => {
    await signInAs(nadia.email);

    const rows = await api.get<ContactPresence[]>("/contacts/presence");

    expect(rows).toHaveLength(3);
    expect(rows).toEqual(
      expect.arrayContaining([
        { internalUserId: rami.id, online: true },
        { internalUserId: staffNamed("Youssef Benali").id, online: true },
        { internalUserId: staffNamed("Salma Tazi").id, online: false },
      ]),
    );
    expect(rows.map((row) => row.internalUserId)).not.toContain(maya.id);
  });

  it("a colleague's profile says whether they're online only to their contacts (and you're online to yourself)", async () => {
    await signInAs(nadia.email);

    await expect(api.get<StaffProfile>(`/staff-profile/${rami.id}`)).resolves.toMatchObject({ online: true });
    await expect(api.get<StaffProfile>(`/staff-profile/${maya.id}`)).resolves.toMatchObject({ online: null });
    await expect(api.get<StaffProfile>(`/staff-profile/${nadia.id}`)).resolves.toMatchObject({ online: true });
  });

  it("a customer token gets a 403 (7002)", async () => {
    tokens.set(await api.post<AuthResponse>("/auth/login", { email: MOCK_USER.email, password: "x" }, { auth: false }));

    await expect(api.get("/contacts/presence")).rejects.toMatchObject({ status: 403, errorCode: 7002 });
  });
});
