import { http } from "msw/http";

import type { ApiKey, ApiKeyPayload, CreatedApiKey } from "../types";
import { internalUsers, ORGANIZATIONS } from "./data";
import { notifyAction, type Who } from "./notification-store";
import { error, ok } from "./respond";
import { staffCaller } from "./staff-auth";

/**
 * Partner API keys (backend ApiKeysController): admins only, which
 * requireStaffAccess (staff-auth.ts) checks before these handlers run. The
 * mock never keeps a full key: it exists only in the create response.
 */

/** Backend error codes. */
const API_KEY_NOT_FOUND = 16001;
const API_KEY_BRANCH_INACTIVE = 16002;
const ORGANIZATION_NOT_FOUND = 4001;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const keys: ApiKey[] = [];

/** A branch's keys, revoked ones included: they'd be deleted with it (organizations.ts). */
export const apiKeyCountOf = (organizationId: string) => keys.filter((key) => key.organization.id === organizationId).length;

const hex = (bytes: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) => byte.toString(16).padStart(2, "0")).join("");

/** "stk_" + 64 hex characters, like the backend's (crypto.randomBytes(32)). */
const newKey = () => `stk_${hex(32)}`;
const mask = (key: string) => `${key.slice(0, 8)}…${key.slice(-4)}`;

const payloadOf = (key: ApiKey): ApiKeyPayload => ({
  apiKeyId: key.id,
  name: key.name,
  organizationId: key.organization.id,
  branchName: key.organization.name,
  maskedKey: key.maskedKey,
});

const actorOf = (request: Request): Who | null => {
  const { caller } = staffCaller(request);
  return caller ? { id: caller.id, accountType: "staff" } : null;
};

/** Newest first (the backend orders by createdAt, then id). */
const newestFirst = (a: ApiKey, b: ApiKey) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

export const apiKeyHandlers = [
  http.get("*/api/api-keys", ({ request }) => {
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (organizationId !== null && !UUID.test(organizationId)) {
      return error(400, ["organizationId must be a UUID"]);
    }
    const list = keys.filter((key) => !organizationId || key.organization.id === organizationId);
    return ok([...list].sort(newestFirst));
  }),

  http.post("*/api/api-keys", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const messages = [
      ...Object.keys(body)
        .filter((field) => field !== "name" && field !== "organizationId")
        .map((field) => `property ${field} should not exist`),
      !name && "name should not be empty",
      name.length > 100 && "name must be shorter than or equal to 100 characters",
      !UUID.test(String(body.organizationId ?? "")) && "organizationId must be a UUID",
    ].filter((message): message is string => Boolean(message));
    if (messages.length > 0) return error(400, messages);

    const branch = ORGANIZATIONS.find((org) => org.id === body.organizationId);
    if (!branch) return error(404, [`Organization ${String(body.organizationId)} not found`], ORGANIZATION_NOT_FOUND);
    if (!branch.isActive) {
      return error(400, [`Branch ${branch.name} is inactive. Reactivate it before creating an API key`], API_KEY_BRANCH_INACTIVE);
    }

    const { caller } = staffCaller(request);
    const plaintext = newKey();
    const record: ApiKey = {
      id: crypto.randomUUID(),
      name,
      maskedKey: mask(plaintext),
      organization: { id: branch.id, name: branch.name },
      createdBy: caller ? { id: caller.id, name: caller.name } : null,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      revokedAt: null,
    };
    keys.push(record);
    notifyAction({ type: "API_KEY_CREATED", apiKey: payloadOf(record) }, actorOf(request));
    return ok<CreatedApiKey>({ ...record, key: plaintext }, 201);
  }),

  // Idempotent: revoking again keeps the first date and tells no one.
  http.delete("*/api/api-keys/:id", ({ params, request }) => {
    const id = String(params.id);
    if (!UUID.test(id)) return error(400, ["Validation failed (uuid is expected)"]);
    const key = keys.find((candidate) => candidate.id === id);
    if (!key) return error(404, [`API key ${id} not found`], API_KEY_NOT_FOUND);
    if (!key.revokedAt) {
      key.revokedAt = new Date().toISOString();
      notifyAction({ type: "API_KEY_REVOKED", apiKey: payloadOf(key) }, actorOf(request));
    }
    return ok(key);
  }),
];

/* ---------------------------------------------------------------------------
 * Seeds: a few keys on the mock branches, one revoked, one never used. The
 * newest one also seeds its "New API key" notification for the other admins.
 * ------------------------------------------------------------------------ */
{
  const HOUR = 3_600_000;
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
  const admin = (name: string) => internalUsers.find((user) => user.name === name)!;
  const active = ORGANIZATIONS.filter((org) => org.isActive);
  const seed = (name: string, branchIndex: number, by: string, createdHoursAgo: number, extra: Partial<ApiKey> = {}) => {
    const branch = active[branchIndex % active.length]!;
    const creator = admin(by);
    const record: ApiKey = {
      id: crypto.randomUUID(),
      name,
      maskedKey: mask(newKey()),
      organization: { id: branch.id, name: branch.name },
      createdBy: { id: creator.id, name: creator.name },
      createdAt: ago(createdHoursAgo * HOUR),
      lastUsedAt: null,
      revokedAt: null,
      ...extra,
    };
    keys.push(record);
    return record;
  };

  seed("Carrier tracking sync", 0, "Nadia Haddad", 24 * 30, { lastUsedAt: ago(0.2 * HOUR) });
  seed("Old warehouse import", 0, "Youssef Benali", 24 * 45, {
    lastUsedAt: ago(24 * 20 * HOUR),
    revokedAt: ago(24 * 14 * HOUR),
  });
  seed("Marketplace orders", 1, "Nadia Haddad", 24 * 6, { lastUsedAt: ago(26 * HOUR) });
  const newest = seed("Partner test key", 1, "Youssef Benali", 3);
  notifyAction(
    { type: "API_KEY_CREATED", apiKey: payloadOf(newest) },
    { id: newest.createdBy!.id, accountType: "staff" },
    { at: newest.createdAt },
  );
}
