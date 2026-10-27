import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { api } from "./client";
import { keys } from "./keys";
import { tokens } from "./session";
import type {
  AuthResponse,
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  MessageResponse,
  OAuthExchangeInput,
  RegisterInput,
  ResendOtpInput,
  ResetPasswordInput,
  User,
  VerifyOtpInput,
} from "./types";

/** Backend AuthErrorCodes / UserErrorCodes / OtpErrorCodes, for the auth forms' messages. */
export const INVALID_CREDENTIALS = 2002;
export const INVALID_RESET_TOKEN = 2004;
export const ACCOUNT_NOT_VERIFIED = 2005;
export const OAUTH_ACCOUNT_CONFLICT = 2008;
export const WRONG_AUTH_PROVIDER = 2009;
export const OAUTH_CODE_INVALID = 2010;
export const GOOGLE_EMAIL_NOT_VERIFIED = 2011;
export const EMAIL_ALREADY_REGISTERED = 1002;
export const OTP_INVALID = 15003;
export const ACCOUNT_DEACTIVATED = 2012;
/** The Google round-trip itself failed: denied consent, or a provider error. */
export const GOOGLE_AUTH_FAILED = 2013;

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
      // Nothing cached from a previous account (or a previous customer on this
      // browser) may show to this one — same as staff's useStaffLogin.
      queryClient.clear();
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

/**
 * POST /auth/register. No session starts here — the account is unverified
 * until POST /auth/verify-otp succeeds. A prior unverified registration with
 * the same email silently resends the OTP instead of erroring.
 */
export function useRegister() {
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<{ message: string; email: string }>("/auth/register", input, { auth: false }),
  });
}

/** POST /auth/verify-otp. Completes registration and starts the session on success. */
export function useVerifyOtp() {
  const { startSession } = useSessionActions();
  return useMutation({
    mutationFn: (input: VerifyOtpInput) => api.post<AuthResponse>("/auth/verify-otp", input, { auth: false }),
    onSuccess: startSession,
  });
}

/** POST /auth/resend-otp. */
export function useResendOtp() {
  return useMutation({
    mutationFn: (input: ResendOtpInput) =>
      api.post<{ message: string; email: string }>("/auth/resend-otp", input, { auth: false }),
  });
}

/** POST /auth/login. On success the session starts; errors are ApiErrors (2002, 2005, 2009). */
export function useLogin() {
  const { startSession } = useSessionActions();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<AuthResponse>("/auth/login", input, { auth: false }),
    onSuccess: startSession,
  });
}

/**
 * POST /auth/forgot-password. Always succeeds with the same message whether
 * or not the email exists — the caller must not imply otherwise.
 */
export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) =>
      api.post<MessageResponse>("/auth/forgot-password", input, { auth: false }),
  });
}

/**
 * POST /auth/reset-password. Succeeding here force-ends every session on the
 * account server-side (the backend clears all refresh tokens) — this device
 * included, so the caller should route to /login, not straight into the app.
 */
export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) =>
      api.post<MessageResponse>("/auth/reset-password", input, { auth: false }),
  });
}

/** POST /auth/oauth/exchange. Trades the one-time code from /auth/oauth-callback for a session. */
export function useOAuthExchange() {
  const { startSession } = useSessionActions();
  return useMutation({
    mutationFn: (input: OAuthExchangeInput) => api.post<AuthResponse>("/auth/oauth/exchange", input, { auth: false }),
    onSuccess: startSession,
  });
}

/**
 * POST /auth/change-password. A wrong current password is an ApiError with
 * code 2002 and the session stays. Other sessions stay signed in too: offer
 * useLogoutEverywhere after it.
 */
export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.post<MessageResponse>("/auth/change-password", input),
  });
}

/**
 * Sign out: ends the session here at once (the route guard then shows the
 * login page), then revokes the refresh token in the background
 * (POST /auth/logout). Never fails: if the revoke can't reach the server, the
 * token just expires — the backend route itself is @Public and fails open.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    const refreshToken = tokens.getRefresh();
    tokens.clear();
    queryClient.clear();
    if (refreshToken) {
      void api.post<MessageResponse>("/auth/logout", { refreshToken }, { auth: false }).catch(() => undefined);
    }
  }, [queryClient]);
}

/**
 * POST /auth/logout-all: ends every session of this account, this one
 * included. Unlike useLogout it waits for the server: if the request fails,
 * the other sessions are still signed in, and the caller should say so.
 */
export function useLogoutEverywhere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MessageResponse>("/auth/logout-all"),
    onSuccess: () => {
      tokens.clear();
      queryClient.clear();
    },
  });
}
