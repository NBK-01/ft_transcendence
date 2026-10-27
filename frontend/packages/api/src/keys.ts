import type { AdminShipmentFilters, NotificationFilters, OverviewStatsQuery } from "./types";

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
  staffAuth: {
    me: ["staff-auth", "me"] as const,
  },
  staffProfiles: {
    all: ["staff-profiles"] as const,
    detail: (id: string) => [...keys.staffProfiles.all, id] as const,
  },
  internalUsers: {
    all: ["internal-users"] as const,
    list: () => [...keys.internalUsers.all, "list"] as const,
  },
  roles: {
    all: ["roles"] as const,
  },
  chat: {
    all: ["chat"] as const,
    conversations: () => [...keys.chat.all, "conversations"] as const,
    messages: (conversationId: string) => [...keys.chat.all, "messages", conversationId] as const,
    support: () => [...keys.chat.all, "support"] as const,
  },
  contacts: {
    all: ["contacts"] as const,
    list: () => [...keys.contacts.all, "list"] as const,
    presence: () => [...keys.contacts.all, "presence"] as const,
  },
  organizations: {
    all: ["organizations"] as const,
    list: () => [...keys.organizations.all, "list"] as const,
    detail: (id: string) => [...keys.organizations.all, "detail", id] as const,
    staff: (id: string) => [...keys.organizations.all, "staff", id] as const,
  },
  adminShipments: {
    all: ["admin-shipments"] as const,
    lists: () => [...keys.adminShipments.all, "list"] as const,
    list: (filters: AdminShipmentFilters) => [...keys.adminShipments.lists(), filters] as const,
    // Events and files sit under their shipment, so invalidating it refreshes all three.
    detail: (trackingId: string) => [...keys.adminShipments.all, "detail", trackingId] as const,
    events: (trackingId: string) => [...keys.adminShipments.detail(trackingId), "events"] as const,
    files: (trackingId: string) => [...keys.adminShipments.detail(trackingId), "files"] as const,
    // The overview's numbers: every status change refreshes them, like the lists.
    stats: () => [...keys.adminShipments.all, "stats"] as const,
    overviewStats: (query: OverviewStatsQuery) => [...keys.adminShipments.stats(), "overview", query] as const,
  },
  // Whoever is signed in: sign-out clears the whole cache, so one account never sees another's.
  notifications: {
    all: ["notifications"] as const,
    lists: () => [...keys.notifications.all, "list"] as const,
    // No page: a list holds every page loaded so far (useInfiniteQuery).
    list: (filters: Omit<NotificationFilters, "page">) => [...keys.notifications.lists(), filters] as const,
    unreadCount: () => [...keys.notifications.all, "unread-count"] as const,
  },
  apiKeys: {
    all: ["api-keys"] as const,
    list: (filters: { organizationId?: string }) => [...keys.apiKeys.all, "list", filters] as const,
  },
};
