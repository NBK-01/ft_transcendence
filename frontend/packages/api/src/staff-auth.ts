import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useSyncExternalStore } from "react";

import { api } from "./client";
import { keys } from "./keys";
import { tokens } from "./session";
import type {
  MessageResponse,
  StaffAuthResponse,
  StaffChangePasswordInput,
  StaffLoginInput,
  StaffMe,
  StaffUser,
} from "./types";

/**
 * Staff sign-in for the admin app (backend StaffAuthController). The admin app
 * calls configureApi with `refreshPath: "/staff-auth/refresh"` and its own
 * `storageKey`, so these tokens never mix with a customer session.
 */

/** Backend StaffAuthErrorCodes / AccessControlErrorCodes, for the login form's messages. */
export const STAFF_INVALID_CREDENTIALS = 8003;
export const STAFF_ACCOUNT_INACTIVE = 7003;

export type StaffSessionState =
  | { status: "authenticated"; user: StaffUser }
  /** `signedOut`: this tab signed out on purpose, as opposed to never signed in or an expired session. */
  | { status: "anonymous"; user: null; signedOut: boolean };

let signedOutHere = false;
const sessionSnapshot = () => (tokens.hasSession() ? "active" : signedOutHere ? "signed-out" : "none");

/**
 * What the route guard and the account menu read. Synchronous: the user is
 * stored with the tokens, so there's no loading state. A revoked or expired
 * refresh token shows up on the first request, which ends the session.
 */
export function useStaffSession(): StaffSessionState {
  const session = useSyncExternalStore(tokens.subscribe, sessionSnapshot, () => "none");
  const user = useSyncExternalStore(tokens.subscribe, () => tokens.getUser<StaffUser>(), () => null);
  return session === "active" && user
    ? { status: "authenticated", user }
    : { status: "anonymous", user: null, signedOut: session === "signed-out" };
}

/**
 * GET /staff-auth/me: the signed-in staff member as they are now, with their
 * branch and permissions. It also brings the stored session user up to date,
 * so a rename or a new role shows in the account menu without signing in again.
 */
export function useStaffMe({ enabled = true }: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: keys.staffAuth.me,
    queryFn: ({ signal }) => api.get<StaffMe>("/staff-auth/me", { signal }),
    enabled,
    staleTime: 60_000,
  });
  const me = query.data;
  useEffect(() => {
    const stored = tokens.getUser<StaffUser>();
    if (!me || !stored || stored.id !== me.id) return;
    if (stored.name !== me.name || stored.email !== me.email || stored.roleName !== me.roleName) {
      tokens.setUser({ id: me.id, email: me.email, name: me.name, roleName: me.roleName });
    }
  }, [me]);
  return query;
}

/** POST /staff-auth/login. On success the session starts; errors are ApiErrors (8003, 7003). */
export function useStaffLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffLoginInput) => api.post<StaffAuthResponse>("/staff-auth/login", input, { auth: false }),
    onSuccess: ({ user, ...pair }) => {
      // Nothing cached from a previous account may show to this one.
      queryClient.clear();
      signedOutHere = false;
      tokens.set(pair, user);
    },
  });
}

/**
 * Sign out: ends the session here at once (the route guard then shows the
 * login page, with `signedOut` set), then revokes the refresh token in the
 * background (POST /staff-auth/logout). Never fails: if the revoke can't reach
 * the server, the token just expires.
 */
export function useStaffLogout() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    const refreshToken = tokens.getRefresh();
    signedOutHere = true;
    tokens.clear();
    queryClient.clear();
    if (refreshToken) {
      void api.post<MessageResponse>("/staff-auth/logout", { refreshToken }, { auth: false }).catch(() => undefined);
    }
  }, [queryClient]);
}

/**
 * POST /staff-auth/change-password. A wrong current password is an ApiError
 * with code 8003 and the session stays. Other sessions stay signed in too:
 * offer useStaffLogoutEverywhere after it.
 */
export function useChangeStaffPassword() {
  return useMutation({
    mutationFn: (input: StaffChangePasswordInput) =>
      api.post<MessageResponse>("/staff-auth/change-password", input),
  });
}

/**
 * POST /staff-auth/logout-all: ends every session of this account, this one
 * included, so the route guard then shows the login page. Unlike useStaffLogout
 * it waits for the server: if the request fails, the other sessions are still
 * signed in, and the caller should say so.
 */
export function useStaffLogoutEverywhere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MessageResponse>("/staff-auth/logout-all"),
    onSuccess: () => {
      signedOutHere = true;
      tokens.clear();
      queryClient.clear();
    },
  });
}
