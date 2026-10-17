import { useQuery } from "@tanstack/react-query";

import { api, keys, type InternalUser, type Organization, type Role } from "@trans/api";

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
