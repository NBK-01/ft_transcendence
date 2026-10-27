import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { keys } from "./keys";
import type { StaffAvatarResult, StaffMe, StaffProfile, UpdateStaffProfileInput } from "./types";

/**
 * A staff member's own name and photo, and colleagues' profile pages (backend
 * StaffProfileController). Reading yourself is useStaffMe (GET /staff-auth/me),
 * which every change here refreshes.
 */

/** GET /staff-profile/:id: a colleague's page. 404 (8001) for an unknown id. */
export function useStaffProfile(id: string) {
  return useQuery({
    queryKey: keys.staffProfiles.detail(id),
    queryFn: ({ signal }) => api.get<StaffProfile>(`/staff-profile/${encodeURIComponent(id)}`, { signal }),
    enabled: id !== "",
  });
}

/** PATCH /staff-profile: your own name. Returns you as you are now, straight into useStaffMe's cache. */
export function useUpdateStaffProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateStaffProfileInput) => api.patch<StaffMe>("/staff-profile", input),
    onSuccess: (me) => {
      queryClient.setQueryData(keys.staffAuth.me, me);
      return queryClient.invalidateQueries({ queryKey: keys.staffProfiles.detail(me.id) });
    },
  });
}

/** After a photo change: you, your own profile page, and anywhere your photo shows. */
function useAfterAvatarChange() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.staffAuth.me }),
      queryClient.invalidateQueries({ queryKey: keys.staffProfiles.all }),
      queryClient.invalidateQueries({ queryKey: keys.contacts.all }),
    ]);
}

/**
 * POST /staff-profile/avatar (multipart, field "file"): JPEG, PNG or WebP up
 * to 2 MB, else 400 (9001 type, 9002 size). Uses `api.upload` (XHR) so the
 * page can show progress.
 */
export function useUploadStaffAvatar() {
  const afterChange = useAfterAvatarChange();
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (fraction: number) => void }) => {
      const form = new FormData();
      form.set("file", file);
      return api.upload<StaffAvatarResult>("/staff-profile/avatar", form, { onProgress });
    },
    onSuccess: afterChange,
  });
}

/** DELETE /staff-profile/avatar: back to your initials. */
export function useRemoveStaffAvatar() {
  const afterChange = useAfterAvatarChange();
  return useMutation({
    mutationFn: () => api.delete<StaffAvatarResult>("/staff-profile/avatar"),
    onSuccess: afterChange,
  });
}
