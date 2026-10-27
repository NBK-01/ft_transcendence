import { http } from "msw/http";

import type { AuthResponse, MessageResponse, TokenPair, User } from "../types";
import { MOCK_USER } from "./data";
import { notifyAction } from "./notification-store";
import { error, ok } from "./respond";

/**
 * Customer auth (backend AuthController). The rest of the client app's mocks
 * (shipments, chat) only know about one customer identity (MOCK_USER) — chat.ts's
 * callerFor hardcodes any "mock-access-*" token to her id — so this doesn't model
 * a real multi-account registry. Logging in with any email/password (other than
 * the literal password "wrong") signs you in as her, same as before; `register` +
 * `verify-otp` only simulate the two-step flow long enough to exercise those
 * screens, with the fixed dev code 123456 (matching the backend's own
 * NODE_ENV=development bypass) standing in for a real emailed OTP.
 *
 * Google OAuth can't be mocked here: `/auth/google` is a real page navigation,
 * not a fetch, so MSW (which only intercepts requests from the already-loaded
 * page) never sees it. Visiting /auth/oauth-callback?code=mock-oauth-code
 * directly exercises the callback page's exchange step instead.
 */

const DEV_OTP = "123456";
const RESET_TOKEN = "mock-reset-token";
const OAUTH_CODE = "mock-oauth-code";

const EMAIL_ALREADY_REGISTERED = 1002;
const INVALID_CREDENTIALS = 2002;
const INVALID_RESET_TOKEN = 2004;
const ACCOUNT_NOT_VERIFIED = 2005;
const OAUTH_CODE_INVALID = 2010;
const OTP_INVALID = 15003;

const ACCESS_PREFIX = "mock-access-";
const REFRESH_PREFIX = "mock-refresh-";

let counter = 0;
const revoked = new Set<string>();
/** logout-all: tokens issued up to this counter value are refused. */
let signedOutUpTo = 0;

const issueTokens = (): TokenPair => {
  counter += 1;
  return { accessToken: `${ACCESS_PREFIX}${counter}`, refreshToken: `${REFRESH_PREFIX}${counter}` };
};

const issuedAt = (token: string, prefix: string) => Number(token.slice(prefix.length));

const isValidAccess = (token: string | null | undefined) =>
  !!token?.startsWith(ACCESS_PREFIX) && issuedAt(token, ACCESS_PREFIX) > signedOutUpTo;

const bearer = (request: Request) => request.headers.get("Authorization")?.replace(/^Bearer /, "");

/** The customer an access token belongs to (always MOCK_USER), for mocks that serve customers and staff alike. */
export const customerForToken = (token: string | null | undefined) => (isValidAccess(token) ? MOCK_USER : undefined);

/** Registered but not yet verified: email -> what they signed up with. */
const pending = new Map<string, { password: string; name: string }>();

export const authHandlers = [
  http.post("*/api/auth/register", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string; name?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (email === MOCK_USER.email) {
      return error(409, ["A user with this email already exists"], EMAIL_ALREADY_REGISTERED);
    }
    pending.set(email, { password: body.password ?? "", name: body.name ?? "" });
    // The backend creates the account here (unverified until the code), which is what tells the admins.
    notifyAction({ type: "CUSTOMER_REGISTERED", customerId: crypto.randomUUID(), name: body.name ?? email }, null);
    return ok<{ message: string; email: string }>({
      message: "Registration successful. Check your email for a verification code.",
      email,
    });
  }),

  http.post("*/api/auth/verify-otp", async ({ request }) => {
    const body = (await request.json()) as { email?: string; otp?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    const registration = pending.get(email);
    if (!registration) return error(404, ["User not found"]);
    if (body.otp !== DEV_OTP) return error(401, ["Invalid OTP"], OTP_INVALID);

    pending.delete(email);
    return ok<AuthResponse>({ ...issueTokens(), user: { id: MOCK_USER.id, email, name: registration.name } });
  }),

  http.post("*/api/auth/resend-otp", async ({ request }) => {
    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!pending.has(email)) return error(404, ["User not found"]);
    return ok<{ message: string; email: string }>({ message: "A new code was sent", email });
  }),

  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (pending.has(email)) return error(403, ["Account is not verified"], ACCOUNT_NOT_VERIFIED);
    if (body.password === "wrong") return error(401, ["Invalid email or password."], INVALID_CREDENTIALS);
    // Like the real AuthService.login: only id, email and name.
    return ok<AuthResponse>({ ...issueTokens(), user: { id: MOCK_USER.id, email, name: MOCK_USER.name } });
  }),

  http.post("*/api/auth/refresh", async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    const token = body.refreshToken;
    const valid = !!token?.startsWith(REFRESH_PREFIX) && !revoked.has(token) && issuedAt(token, REFRESH_PREFIX) > signedOutUpTo;
    if (!valid) return error(401, ["Invalid or expired refresh token."], 2003);
    // Rotates in place: the old refresh token stops working.
    revoked.add(token!);
    return ok<TokenPair>(issueTokens());
  }),

  http.get("*/api/auth/me", ({ request }) => {
    if (!isValidAccess(bearer(request))) return error(401, ["Unauthorized"]);
    return ok<User>(MOCK_USER);
  }),

  // Public, and always 200: an unknown or expired token has nothing left to revoke.
  http.post("*/api/auth/logout", async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    if (body.refreshToken) revoked.add(body.refreshToken);
    return ok<MessageResponse>({ message: "Logged out" });
  }),

  http.post("*/api/auth/logout-all", ({ request }) => {
    if (!isValidAccess(bearer(request))) return error(401, ["Unauthorized"]);
    signedOutUpTo = counter;
    const customer = { id: MOCK_USER.id, accountType: "customer" as const };
    notifyAction({ type: "SESSIONS_REVOKED", account: customer }, customer);
    return ok<MessageResponse>({ message: "Logged out of all sessions" });
  }),

  // Always the same message, whether or not the email exists — matches the real anti-enumeration behavior.
  http.post(
    "*/api/auth/forgot-password",
    () => ok<MessageResponse>({ message: "If the email exists, a password reset link has been sent." }),
  ),

  // No real inbox to read the link from: use token=mock-reset-token to exercise the success path.
  http.post("*/api/auth/reset-password", async ({ request }) => {
    const body = (await request.json()) as { token?: string };
    if (body.token !== RESET_TOKEN) return error(400, ["Invalid or expired reset token"], INVALID_RESET_TOKEN);
    // A security notice to the owner; nobody is signed in during a reset.
    notifyAction({ type: "PASSWORD_CHANGED", account: { id: MOCK_USER.id, accountType: "customer" } }, null);
    return ok<MessageResponse>({ message: "Password reset successfully" });
  }),

  http.post("*/api/auth/oauth/exchange", async ({ request }) => {
    const body = (await request.json()) as { code?: string };
    if (body.code !== OAUTH_CODE) return error(401, ["Invalid or expired code"], OAUTH_CODE_INVALID);
    return ok<AuthResponse>({ ...issueTokens(), user: { id: MOCK_USER.id, email: MOCK_USER.email, name: MOCK_USER.name } });
  }),
];
