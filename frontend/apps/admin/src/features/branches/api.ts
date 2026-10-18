import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  api,
  keys,
  type CreateOrganizationInput,
  type Organization,
  type UpdateOrganizationInput,
} from "@trans/api";

/** Backend OrganizationErrorCodes.OrganizationAlreadyExists (409): the name is taken. */
export const NAME_TAKEN = 4002;

/** GET /organizations: every branch, active or not (unpaginated). */
export function useOrganizations() {
  return useQuery({
    queryKey: keys.organizations.list(),
    queryFn: ({ signal }) => api.get<Organization[]>("/organizations", { signal }),
  });
}

/** POST /organizations. The list refreshes on success. */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => api.post<Organization>("/organizations", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.organizations.all }),
  });
}

/** PATCH /organizations/:id (name, description, contact email, active). */
export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateOrganizationInput & { id: string }) =>
      api.patch<Organization>(`/organizations/${encodeURIComponent(id)}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.organizations.all }),
  });
}

/**
 * Deactivate (DELETE, a soft delete) or reactivate (PATCH isActive) a branch.
 * Its members stay assigned either way.
 */
export function useSetOrganizationActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const path = `/organizations/${encodeURIComponent(id)}`;
      if (isActive) await api.patch<Organization>(path, { isActive: true });
      else await api.delete(path);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.organizations.all }),
  });
}
