/**
 * Query keys, in one place so invalidation can't drift out of sync.
 *
 * Pattern for a new resource:
 *   shipments: {
 *     all: ["shipments"] as const,
 *     list: (filters: ShipmentFilters) => [...keys.shipments.all, "list", filters] as const,
 *     detail: (id: string) => [...keys.shipments.all, "detail", id] as const,
 *   },
 * After a mutation: queryClient.invalidateQueries({ queryKey: keys.shipments.all })
 */
export const keys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  users: {
    all: ["users"] as const,
    list: () => [...keys.users.all, "list"] as const,
  },
};
