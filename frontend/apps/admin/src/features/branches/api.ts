import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  api,
  keys,
  type CreateOrganizationInput,
  type InternalUser,
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

/** GET /organizations/:id. A 404 (code 4001) isn't retried, so a bad link fails fast. */
export function useOrganization(id: string) {
  return useQuery({
    queryKey: keys.organizations.detail(id),
    queryFn: ({ signal }) => api.get<Organization>(`/organizations/${encodeURIComponent(id)}`, { signal }),
  });
}

/** GET /organizations/:id/staff: the branch's members. */
export function useBranchStaff(id: string) {
  return useQuery({
    queryKey: keys.organizations.staff(id),
    queryFn: ({ signal }) =>
      api.get<InternalUser[]>(`/organizations/${encodeURIComponent(id)}/staff`, { signal }),
  });
}

/** POST /organizations/:id/staff/:userId. Moves them: they leave the branch they were in. */
export function useAssignStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, userId }: { branchId: string; userId: string }) =>
      api.post(`/organizations/${encodeURIComponent(branchId)}/staff/${encodeURIComponent(userId)}`),
    onSettled: () => invalidateMembership(queryClient),
  });
}

/** DELETE /organizations/:id/staff/:userId. They keep their account, with no branch. */
export function useRemoveStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, userId }: { branchId: string; userId: string }) =>
      api.delete(`/organizations/${encodeURIComponent(branchId)}/staff/${encodeURIComponent(userId)}`),
    onSettled: () => invalidateMembership(queryClient),
  });
}

/** Membership shows on the branch pages (members, counts) and the Users page (branch column). */
function invalidateMembership(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.organizations.all }),
    queryClient.invalidateQueries({ queryKey: keys.internalUsers.all }),
  ]);
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
