import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, keys, useSessionActions, type MessageResponse } from "@trans/api";

import type { AvatarUploadResult, Profile, ProfileUpdate } from "./types";

/** The shared `api` client unwraps the backend's { success, statusCode, data } envelope. */

export const profileKeys = {
  me: ["profile", "me"] as const,
};

/** GET /users/profile — the signed-in user's profile (real endpoint). */
export function useProfile() {
  return useQuery({
    queryKey: profileKeys.me,
    queryFn: ({ signal }) => api.get<Profile>("/users/profile", { signal }),
  });
}

/** PATCH /users/profile — save names, birth date and phone (real endpoint). */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileUpdate) => api.patch<Profile>("/users/profile", input),
    // The response is the updated profile: put it straight in the cache. The
    // session user (name in the header) comes from /auth/me, so that refetches.
    onSuccess: (profile) => {
      queryClient.setQueryData(profileKeys.me, profile);
      return queryClient.invalidateQueries({ queryKey: keys.auth.me });
    },
  });
}

/**
 * POST /users/profile/avatar (real) — multipart, field "file". Uses `api.upload`
 * (XHR) instead of `api.post` so the page can show upload progress.
 */
export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (fraction: number) => void }) => {
      const form = new FormData();
      form.set("file", file);
      return api.upload<AvatarUploadResult>("/users/profile/avatar", form, { onProgress });
    },
    onSuccess: ({ avatarUrl }) => {
      queryClient.setQueryData<Profile>(profileKeys.me, (profile) => (profile ? { ...profile, avatarUrl } : profile));
      return queryClient.invalidateQueries({ queryKey: keys.auth.me });
    },
  });
}

/** DELETE /users/profile/avatar (real) — idempotent: no avatar set is a clean no-op. */
export function useDeleteAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete<MessageResponse>("/users/profile/avatar"),
    onSuccess: () => {
      queryClient.setQueryData<Profile>(profileKeys.me, (profile) => (profile ? { ...profile, avatarUrl: null } : profile));
      return queryClient.invalidateQueries({ queryKey: keys.auth.me });
    },
  });
}

/**
 * POST /auth/account/deactivate — blocks future login and ends every session
 * server-side, but the row (and their shipment/message history) stays.
 * Reversible by support. On success ends the session here too; the caller
 * navigates to /login.
 */
export function useDeactivateAccount() {
  const { endSession } = useSessionActions();
  return useMutation({
    mutationFn: () => api.post<MessageResponse>("/auth/account/deactivate"),
    onSuccess: endSession,
  });
}

/**
 * DELETE /auth/account — permanent: the account, its shipments, messages and
 * uploaded avatar are gone, not just locked out. On success ends the session
 * here too; the caller navigates to /login.
 */
export function useDeleteAccount() {
  const { endSession } = useSessionActions();
  return useMutation({
    mutationFn: () => api.delete<MessageResponse>("/auth/account"),
    onSuccess: endSession,
  });
}
