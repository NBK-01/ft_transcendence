import { http } from "msw/http";

import type { AuthResponse, TokenPair, User } from "../types";
import { error, ok } from "./respond";
import { staffHandlers } from "./staff";

export { error, ok, paginated } from "./respond";

/**
 * Mock backend for development (VITE_API_MOCKS=true).
 * Each handler mirrors a real endpoint's contract, including errors, so the
 * screens behave the same against mocks and the real API.
 *
 * When the real endpoint ships: delete its handler here. Nothing else changes.
 * Requests with no handler pass through to the real backend (Vite proxy).
 */

const MOCK_USER: User = {
  id: "8f0c1d2e-0000-4000-8000-000000000001",
  email: "amina@example.com",
  name: "Amina El Idrissi",
  isVerified: true,
  createdAt: "2026-09-01T09:00:00.000Z",
  updatedAt: "2026-10-01T09:00:00.000Z",
};

let counter = 0;
const issueTokens = (): TokenPair => {
  counter += 1;
  return { accessToken: `mock-access-${counter}`, refreshToken: `mock-refresh-${counter}` };
};

const isAuthorized = (request: Request) =>
  request.headers.get("Authorization")?.startsWith("Bearer mock-access-") ?? false;

export const handlers = [
  http.post("*/api/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) return error(400, ["email must be an email"]);
    if (body.password === "wrong") return error(401, ["Invalid email or password."], 2002);
    return ok<AuthResponse>({ ...issueTokens(), user: { ...MOCK_USER, email: body.email } });
  }),

  http.post("*/api/auth/refresh", async ({ request }) => {
    const body = (await request.json()) as { refreshToken?: string };
    if (!body.refreshToken?.startsWith("mock-refresh-")) {
      return error(401, ["Invalid or expired refresh token."], 2003);
    }
    return ok<TokenPair>(issueTokens());
  }),

  http.get("*/api/auth/me", ({ request }) => {
    if (!isAuthorized(request)) return error(401, ["Unauthorized"]);
    return ok<User>(MOCK_USER);
  }),

  ...staffHandlers,
];
