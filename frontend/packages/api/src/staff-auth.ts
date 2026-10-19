import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { api } from "./client";
import { tokens } from "./session";
import type { MessageResponse, StaffAuthResponse, StaffLoginInput, StaffUser } from "./types";

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
  | { status: "anonymous"; user: null };

/**
 * What the route guard and the account menu read. Synchronous: the user is
 * stored with the tokens, so there's no loading state. A revoked or expired
 * refresh token shows up on the first request, which sends you to login.
 */
export function useStaffSession(): StaffSessionState {
  const hasSession = useSyncExternalStore(tokens.subscribe, tokens.hasSession, () => false);
  const user = useSyncExternalStore(tokens.subscribe, () => tokens.getUser<StaffUser>(), () => null);
  return hasSession && user ? { status: "authenticated", user } : { status: "anonymous", user: null };
}

/** POST /staff-auth/login. On success the session starts; errors are ApiErrors (8003, 7003). */
export function useStaffLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StaffLoginInput) => api.post<StaffAuthResponse>("/staff-auth/login", input, { auth: false }),
    onSuccess: ({ user, ...pair }) => {
      // Nothing cached from a previous account may show to this one.
      queryClient.clear();
      tokens.set(pair, user);
    },
  });
}

/**
 * Sign out: ends the session here at once, then revokes the refresh token
 * (POST /staff-auth/logout). Signing out never fails: if the revoke can't
 * reach the server, the token just expires.
 */
export function useStaffLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = tokens.getRefresh();
      tokens.clear();
      queryClient.clear();
      if (!refreshToken) return;
      await api.post<MessageResponse>("/staff-auth/logout", { refreshToken }, { auth: false }).catch(() => undefined);
    },
  });
}
