import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  api,
  keys,
  type CreateInternalUserInput,
  type InternalUser,
  type Role,
  type UpdateInternalUserInput,
} from "@trans/api";

/** Backend InternalUserErrorCodes.InternalUserAlreadyExists (409): the email is taken. */
export const EMAIL_TAKEN = 8002;

/** GET /internal-users: every staff account (unpaginated, so the table sorts and filters in the browser). */
export function useInternalUsers() {
  return useQuery({
    queryKey: keys.internalUsers.list(),
    queryFn: ({ signal }) => api.get<InternalUser[]>("/internal-users", { signal }),
  });
}

/** GET /access-control/roles: rarely changes, so it stays fresh for the session. */
export function useRoles() {
  return useQuery({
    queryKey: keys.roles.all,
    queryFn: ({ signal }) => api.get<Role[]>("/access-control/roles", { signal }),
    staleTime: Infinity,
  });
}

/** POST /internal-users. The list refreshes on success. */
export function useCreateInternalUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInternalUserInput) => api.post<InternalUser>("/internal-users", input),
    onSuccess: () => invalidateStaff(queryClient),
  });
}

/** PATCH /internal-users/:id (name, role, branch, active). The list refreshes on success. */
export function useUpdateInternalUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateInternalUserInput & { id: string }) =>
      api.patch<InternalUser>(`/internal-users/${encodeURIComponent(id)}`, input),
    onSuccess: () => invalidateStaff(queryClient),
  });
}

/**
 * Deactivate or reactivate one or more accounts (PATCH isActive). There's no bulk
 * endpoint, so it's one request per user; the result says how many failed.
 */
export function useSetStaffActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, isActive }: { ids: string[]; isActive: boolean }) => {
      const results = await Promise.allSettled(
        ids.map((id) => api.patch<InternalUser>(`/internal-users/${encodeURIComponent(id)}`, { isActive })),
      );
      const failed = results.filter((result) => result.status === "rejected").length;
      return { updated: ids.length - failed, failed };
    },
    onSettled: () => invalidateStaff(queryClient),
  });
}

/** Staff also show on the branch pages (member lists and counts), so those refresh too. */
function invalidateStaff(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.internalUsers.all }),
    queryClient.invalidateQueries({ queryKey: keys.organizations.all }),
  ]);
}
