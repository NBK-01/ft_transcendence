import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { api } from "./client";
import { keys } from "./keys";
import { tokens } from "./session";
import type { AuthResponse, User } from "./types";

/** GET /auth/me — the signed-in user. Only runs when there's a session to use. */
export function useMe() {
  const hasSession = useSyncExternalStore(tokens.subscribe, tokens.hasSession, () => false);
  return useQuery({
    queryKey: keys.auth.me,
    queryFn: ({ signal }) => api.get<User>("/auth/me", { signal }),
    enabled: hasSession,
  });
}

export type SessionState =
  | { status: "loading"; user: null }
  | { status: "authenticated"; user: User }
  | { status: "anonymous"; user: null };

/** What route guards and the account menu read. */
export function useSession(): SessionState {
  const hasSession = useSyncExternalStore(tokens.subscribe, tokens.hasSession, () => false);
  const me = useMe();

  if (!hasSession) return { status: "anonymous", user: null };
  if (me.data) return { status: "authenticated", user: me.data };
  if (me.isError) return { status: "anonymous", user: null };
  return { status: "loading", user: null };
}

/** Call after a successful login / verify-otp, and on sign-out. */
export function useSessionActions() {
  const queryClient = useQueryClient();

  const startSession = useCallback(
    (response: AuthResponse) => {
      tokens.set(response);
      // The login response only has id, email and name, so load the full user from /auth/me.
      void queryClient.invalidateQueries({ queryKey: keys.auth.me });
    },
    [queryClient],
  );

  const endSession = useCallback(() => {
    // Local only. Revoking the refresh token (POST /auth/logout) is the caller's job, before this.
    tokens.clear();
    queryClient.clear();
  }, [queryClient]);

  return { startSession, endSession };
}
