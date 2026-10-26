import { http } from "msw/http";

import { INSUFFICIENT_PERMISSIONS, roleCan } from "../permissions";
import type { MessageResponse, StaffAuthResponse, TokenPair } from "../types";
import { internalUsers, staffPasswords } from "./data";
import { notifyAction } from "./notification-store";
import { error, ok } from "./respond";

/**
 * Staff sign-in (backend StaffAuthController). Every mock account signs in
 * with MOCK_STAFF_PASSWORD (see data.ts), e.g. nadia.haddad@shiptrack.example
 * (admin) or rami.khoury@shiptrack.example (dispatcher).
 *
 * Tokens carry the account id, so a refresh still works after a page reload,
 * when this module's state starts over. Only tokens revoked since the page
 * loaded are refused.
 */

/** Backend StaffAuthErrorCodes and AccessControlErrorCodes. */
const INVALID_CREDENTIALS = 8003;
const INVALID_REFRESH_TOKEN = 8004;
const ACCOUNT_INACTIVE = 7003;

const ACCESS_PREFIX = "mock-staff-access-";
const REFRESH_PREFIX = "mock-staff-refresh-";

let counter = 0;
const revoked = new Set<string>();
/** logout-all: tokens issued up to this counter value are refused, per account. */
const signedOutUpTo = new Map<string, number>();

const issueTokens = (userId: string): TokenPair => {
  counter += 1;
  return { accessToken: `${ACCESS_PREFIX}${counter}.${userId}`, refreshToken: `${REFRESH_PREFIX}${counter}.${userId}` };
};

/** The account a token belongs to, or undefined if it isn't one of ours or was signed out everywhere. */
const accountOf = (token: string | null | undefined, prefix: string) => {
  if (!token?.startsWith(prefix)) return undefined;
  const dot = token.indexOf(".");
  const issued = Number(token.slice(prefix.length, dot));
  const user = internalUsers.find((candidate) => candidate.id === token.slice(dot + 1));
  if (!user || issued <= (signedOutUpTo.get(user.id) ?? 0)) return undefined;
  return user;
};

const bearer = (request: Request) => request.headers.get("Authorization")?.replace(/^Bearer /, "");

/** Like the backend's JwtAuthGuard: no valid token, 401 without an error code. */
const unauthorized = () => error(401, ["Authentication failed"]);

/** The active staff member an access token belongs to (for the chat mocks, which read the token directly). */
export const staffForToken = (token: string | null | undefined) => {
  const user = accountOf(token, ACCESS_PREFIX);
  return user?.isActive ? user : undefined;
};

/** @RequireStaff(): the signed-in, active staff member, or the 401 the backend would send. */
export const staffCaller = (request: Request) => {
  const caller = accountOf(bearer(request), ACCESS_PREFIX);
  if (!caller) return { response: unauthorized() };
  if (!caller.isActive) return { response: error(401, ["This staff account has been deactivated"], ACCOUNT_INACTIVE) };
  return { caller };
};

/** Whether a role may make this request, per the rules on requireStaffAccess. */
function roleAllows(roleName: string | null, method: string, pathname: string) {
  if (/\/api\/(internal-users|access-control|api-keys)(\/|$)/.test(pathname)) return roleName === "admin";
  if (/\/api\/organizations(\/|$)/.test(pathname)) return method === "GET" || roleCan(roleName, "organizations:manage");
  if (/\/api\/admin\/shipments(\/|$)/.test(pathname)) {
    return roleCan(roleName, method === "GET" ? "shipments:read:all" : "shipments:update:org");
  }
  if (/\/api\/admin\/stats(\/|$)/.test(pathname)) return roleCan(roleName, "shipments:read:all");
  return true;
}

/**
 * Runs before the staff-only handlers, in the same order as the backend's
 * guards: no staff token → 401; a deactivated account → 401 (7003); a role
 * without access → 403 (7001). Otherwise it returns nothing, so MSW moves on
 * to the matching handler. The role is read from the account as it is now,
 * like the backend does, not from when the token was issued.
 *  - Staff accounts, roles and API keys (@RequireRole("admin")): admins only.
 *  - Branches: any staff member may read; changes need "organizations:manage".
 *  - Contacts: any staff member.
 *  - Shipments (/admin/shipments): reading needs "shipments:read:all" (admin,
 *    support), every change "shipments:update:org" (admin, dispatcher).
 *  - Stats (/admin/stats): "shipments:read:all", like reading shipments.
 */
export const requireStaffAccess = http.all(
  /\/api\/(internal-users|organizations|access-control|contacts|admin\/shipments|admin\/stats|api-keys)(\/|$|\?)/,
  ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;

    if (!roleAllows(caller.roleName, request.method, new URL(request.url).pathname)) {
      return error(403, ["You do not have permission to perform this action"], INSUFFICIENT_PERMISSIONS);
    }
  },
);

export const staffAuthHandlers = [
  http.post("*/api/staff-auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const messages = [
      !/^\S+@\S+\.\S+$/.test(email) && "email must be an email",
      !body.password && "password should not be empty",
    ].filter((message): message is string => Boolean(message));
    if (messages.length > 0) return error(400, messages);

    // Same order as StaffAuthService.login: unknown email and wrong password look alike.
    const user = internalUsers.find((candidate) => candidate.email === email);
    if (!user || staffPasswords.get(user.id) !== body.password) {
      return error(401, ["Invalid email or password"], INVALID_CREDENTIALS);
    }
    if (!user.isActive) return error(401, ["This staff account has been deactivated"], ACCOUNT_INACTIVE);

    const { id, name, roleName } = user;
    return ok<StaffAuthResponse>({ ...issueTokens(id), user: { id, email: user.email, name, roleName } });
  }),

  http.post("*/api/staff-auth/refresh", async ({ request }) => {
    const { refreshToken } = (await request.json()) as { refreshToken?: string };
    const user = accountOf(refreshToken, REFRESH_PREFIX);
    if (!user || !user.isActive || revoked.has(refreshToken!)) {
      return error(401, ["Invalid refresh token"], INVALID_REFRESH_TOKEN);
    }
    // Rotates in place: the old refresh token stops working.
    revoked.add(refreshToken!);
    return ok<TokenPair>(issueTokens(user.id));
  }),

  // Public, and always 200: an unknown or expired token has nothing left to revoke.
  http.post("*/api/staff-auth/logout", async ({ request }) => {
    const { refreshToken } = (await request.json()) as { refreshToken?: string };
    if (refreshToken) revoked.add(refreshToken);
    return ok<MessageResponse>({ message: "Logged out" });
  }),

  http.post("*/api/staff-auth/logout-all", ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;
    signedOutUpTo.set(caller.id, counter);
    return ok<MessageResponse>({ message: "Logged out of all sessions" });
  }),

  // Like the backend: other sessions stay signed in (use logout-all for that).
  http.post("*/api/staff-auth/change-password", async ({ request }) => {
    const { caller, response } = staffCaller(request);
    if (!caller) return response;

    const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
    const messages = [
      !body.currentPassword && "currentPassword should not be empty",
      (body.newPassword?.length ?? 0) < 8 && "newPassword must be longer than or equal to 8 characters",
    ].filter((message): message is string => Boolean(message));
    if (messages.length > 0) return error(400, messages);

    // StaffAuthService.changePassword reuses the login error for a wrong current password.
    if (staffPasswords.get(caller.id) !== body.currentPassword) {
      return error(401, ["Invalid email or password"], INVALID_CREDENTIALS);
    }
    staffPasswords.set(caller.id, body.newPassword!);
    // A security notice: the owner hears about it even though they did it.
    const owner = { id: caller.id, accountType: "staff" as const };
    notifyAction({ type: "PASSWORD_CHANGED", account: owner }, owner);
    return ok<MessageResponse>({ message: "Password changed successfully" });
  }),
];
