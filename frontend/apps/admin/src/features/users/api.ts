import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  keys,
  type CreateInternalUserInput,
  type InternalUser,
  type Organization,
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

/** GET /organizations: the branches, for names and the branch filter. */
export function useOrganizations() {
  return useQuery({
    queryKey: keys.organizations.list(),
    queryFn: ({ signal }) => api.get<Organization[]>("/organizations", { signal }),
  });
}

/** POST /internal-users. The list refreshes on success. */
export function useCreateInternalUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateInternalUserInput) => api.post<InternalUser>("/internal-users", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.internalUsers.all }),
  });
}

/** PATCH /internal-users/:id (name, role, branch, active). The list refreshes on success. */
export function useUpdateInternalUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateInternalUserInput & { id: string }) =>
      api.patch<InternalUser>(`/internal-users/${encodeURIComponent(id)}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.internalUsers.all }),
  });
}
