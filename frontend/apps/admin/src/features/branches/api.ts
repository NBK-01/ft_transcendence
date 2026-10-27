import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  api,
  keys,
  type CreateOrganizationInput,
  type InternalUser,
  type MessageResponse,
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
export function useBranchStaff(id: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.organizations.staff(id),
    queryFn: ({ signal }) =>
      api.get<InternalUser[]>(`/organizations/${encodeURIComponent(id)}/staff`, { signal }),
    enabled: enabled && Boolean(id),
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
 * Deactivate or reactivate a branch (PATCH isActive). Its members stay
 * assigned either way, and its history stays.
 */
export function useSetOrganizationActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<Organization>(`/organizations/${encodeURIComponent(id)}`, { isActive }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.organizations.all }),
  });
}

/** Backend OrganizationErrorCodes.OrganizationInUse: it still has staff, shipments or API keys. */
export const ORGANIZATION_IN_USE = 4003;

/** Delete a branch for good: only one with no staff, shipments or API keys (409, ORGANIZATION_IN_USE). */
export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<MessageResponse>(`/organizations/${encodeURIComponent(id)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.organizations.all }),
  });
}
