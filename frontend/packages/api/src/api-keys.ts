import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./client";
import { keys } from "./keys";
import type { ApiKey, CreateApiKeyInput, CreatedApiKey } from "./types";

/**
 * Partner API keys (backend ApiKeysController): admins only
 * (@RequireRole("admin"); other roles get 403, 7001). A key belongs to a
 * branch and opens the public API (/api/v1, X-API-Key) for that branch.
 */

/** Backend PublicApiErrorCodes the admin screens react to. */
export const API_KEY_NOT_FOUND = 14001;
/** 400: the branch is deactivated, so a key for it would be refused on every call. */
export const API_KEY_BRANCH_INACTIVE = 14002;

/** GET /api-keys: every key, masked, newest first, revoked ones included. Optionally one branch's. */
export function useApiKeys(
  { organizationId }: { organizationId?: string } = {},
  { enabled = true }: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: keys.apiKeys.list({ organizationId }),
    queryFn: ({ signal }) => api.get<ApiKey[]>("/api-keys", { query: { organizationId }, signal }),
    enabled,
  });
}

/**
 * POST /api-keys. The response is the only place the full key ever appears:
 * it goes back to the caller (to show once) and never into the cache.
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => api.post<CreatedApiKey>("/api-keys", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.apiKeys.all }),
  });
}

/** DELETE /api-keys/:id: the key stops working at once. Revoking it again changes nothing. */
export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<ApiKey>(`/api-keys/${encodeURIComponent(id)}`),
    onSuccess: (revoked) => {
      // The row turns revoked in every cached list at once, then the lists re-sync.
      queryClient.setQueriesData<ApiKey[]>({ queryKey: keys.apiKeys.all }, (list) =>
        list?.map((key) => (key.id === revoked.id ? revoked : key)),
      );
      return queryClient.invalidateQueries({ queryKey: keys.apiKeys.all });
    },
  });
}
