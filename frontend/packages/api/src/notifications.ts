import {
  infiniteQueryOptions,
  mutationOptions,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { api } from "./client";
import { isApiError } from "./errors";
import { keys } from "./keys";
import type { AppNotification, MessageResponse, NotificationCount, NotificationFilters, Page } from "./types";

/**
 * The signed-in account's notifications (backend NotificationsController),
 * customers and staff alike: the token decides whose they are, so the same
 * hooks serve the client app and the admin.
 */

/** Backend NotificationErrorCodes: an unknown id, a dismissed one, or someone else's (never a 403). */
export const NOTIFICATION_NOT_FOUND = 12001;

/** Notifications per page, the backend's default. */
export const NOTIFICATIONS_PAGE_SIZE = 20;

/**
 * How often the unread count is polled while the tab is visible. Delivery is
 * local-only for now (rows in the feed, no push), so polling is how a badge
 * hears about new ones; once the socket sends them, this can slow down or go.
 */
export const UNREAD_COUNT_REFETCH_MS = 60_000;

type NotificationListFilters = Omit<NotificationFilters, "page">;
type Feed = InfiniteData<Page<AppNotification>, number>;

const itemPath = (id: string, suffix = "") => `/notifications/${encodeURIComponent(id)}${suffix}`;

/** `unreadOnly: false` and no filter are the same request, so they share a cache entry. */
const normalize = ({ unreadOnly, type, limit = NOTIFICATIONS_PAGE_SIZE }: NotificationListFilters) => ({
  unreadOnly: unreadOnly || undefined,
  type,
  limit,
});

/** GET /notifications as an infinite query; useNotifications' options, for prefetching. */
export const notificationListOptions = (filters: NotificationListFilters = {}) => {
  const query = normalize(filters);
  return infiniteQueryOptions({
    queryKey: keys.notifications.list(query),
    queryFn: ({ pageParam, signal }) =>
      api.getPage<AppNotification>("/notifications", { query: { ...query, page: pageParam }, signal }),
    initialPageParam: 1,
    getNextPageParam: (last: Page<AppNotification>) =>
      last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined,
  });
};

/**
 * GET /notifications: the caller's feed, newest first, without dismissed ones.
 * Pages load with "load more" (fetchNextPage), like useMessages, not page by
 * page like useAdminShipments: a feed, in a dropdown or on a page, is one list
 * that grows downwards while new notifications arrive at the top.
 * `notificationsOf` turns the pages into that list.
 *
 * It isn't polled: it refetches when it mounts (opening a dropdown) once its
 * data is older than the app's staleTime, and when the polled unread count changes.
 */
export function useNotifications(filters: NotificationListFilters = {}, { enabled = true }: { enabled?: boolean } = {}) {
  return useInfiniteQuery({ ...notificationListOptions(filters), enabled });
}

/** The pages as one list, newest first. A notification arriving shifts the backend's offset pages, so duplicates are dropped. */
export function notificationsOf(data: InfiniteData<Page<AppNotification>> | undefined): AppNotification[] {
  const byId = new Map<string, AppNotification>();
  for (const page of data?.pages ?? []) for (const item of page.items) if (!byId.has(item.id)) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

/**
 * GET /notifications/unread-count, for a badge. When the number changes, the
 * cached feeds are marked stale too, so a dropdown opened afterwards shows the
 * new ones (and an open one refetches).
 */
export const unreadCountOptions = (queryClient: QueryClient) =>
  queryOptions({
    queryKey: keys.notifications.unreadCount(),
    queryFn: async ({ signal }) => {
      const previous = queryClient.getQueryData<NotificationCount>(keys.notifications.unreadCount());
      const current = await api.get<NotificationCount>("/notifications/unread-count", { signal });
      if (previous && previous.count !== current.count) {
        void queryClient.invalidateQueries({ queryKey: keys.notifications.lists() });
      }
      return current;
    },
  });

/**
 * The unread count, polled every UNREAD_COUNT_REFETCH_MS while the tab is
 * visible (TanStack pauses it in a background tab), and on window focus once
 * it's older than the app's 30 s staleTime. Focus refetching is off app-wide;
 * a badge is the one place it's worth it.
 */
export function useUnreadNotificationCount({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  return useQuery({
    ...unreadCountOptions(queryClient),
    refetchInterval: UNREAD_COUNT_REFETCH_MS,
    refetchOnWindowFocus: true,
    enabled,
  });
}

/* ---------------------------------------------------------------------------
 * Changes: the cached feeds and count update at once, roll back on an error,
 * and every change ends by refetching them from the server.
 * ------------------------------------------------------------------------ */

type Snapshot = Array<[QueryKey, unknown]>;

const isUnread = (notification: AppNotification) => notification.status !== "READ";
const asRead = (notification: AppNotification, readAt: string): AppNotification => ({ ...notification, status: "READ", readAt });
const isNotFound = (error: unknown) => isApiError(error) && error.errorCode === NOTIFICATION_NOT_FOUND;

/** Stops refetches that could overwrite the change, and keeps what was there to roll back to. */
async function snapshot(queryClient: QueryClient): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: keys.notifications.all });
  return queryClient.getQueriesData({ queryKey: keys.notifications.all });
}

function restore(queryClient: QueryClient, previous: Snapshot | undefined) {
  for (const [key, data] of previous ?? []) queryClient.setQueryData(key, data);
}

/** Applies `change` to every cached feed, with that feed's filters (an unread-only feed drops what gets read). */
function updateFeeds(
  queryClient: QueryClient,
  change: (items: AppNotification[], filters: NotificationListFilters) => AppNotification[],
) {
  for (const [key, data] of queryClient.getQueriesData<Feed>({ queryKey: keys.notifications.lists() })) {
    if (!data) continue;
    const filters = key[2] as NotificationListFilters;
    queryClient.setQueryData<Feed>(key, {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: change(page.items, filters) })),
    });
  }
}

function cached(queryClient: QueryClient, id: string) {
  for (const [, data] of queryClient.getQueriesData<Feed>({ queryKey: keys.notifications.lists() })) {
    const found = data?.pages.flatMap((page) => page.items).find((item) => item.id === id);
    if (found) return found;
  }
  return undefined;
}

/** Only when the change is known to affect it: a notification that isn't cached leaves the count to the refetch. */
function setCount(queryClient: QueryClient, next: (count: number) => number) {
  queryClient.setQueryData<NotificationCount>(
    keys.notifications.unreadCount(),
    (current) => current && { count: Math.max(0, next(current.count)) },
  );
}

const resync = (queryClient: QueryClient) => queryClient.invalidateQueries({ queryKey: keys.notifications.all });

/** PATCH /notifications/:id/read. Idempotent: an already read notification keeps its first readAt. */
export const markReadOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => api.patch<AppNotification>(itemPath(id, "/read")),
    onMutate: async (id): Promise<Snapshot> => {
      const previous = await snapshot(queryClient);
      const target = cached(queryClient, id);
      if (target && isUnread(target)) {
        const readAt = new Date().toISOString();
        updateFeeds(queryClient, (items, filters) =>
          filters.unreadOnly
            ? items.filter((item) => item.id !== id)
            : items.map((item) => (item.id === id ? asRead(item, readAt) : item)),
        );
        setCount(queryClient, (count) => count - 1);
      }
      return previous;
    },
    // The server's readAt replaces the local guess.
    onSuccess: (notification) =>
      updateFeeds(queryClient, (items) => items.map((item) => (item.id === notification.id ? notification : item))),
    onError: (_error, _id, previous) => restore(queryClient, previous),
    onSettled: () => resync(queryClient),
  });

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation(markReadOptions(queryClient));
}

/** PATCH /notifications/read-all: every unread one, of any type. Returns how many it marked. */
export const markAllReadOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: () => api.patch<NotificationCount>("/notifications/read-all"),
    onMutate: async (): Promise<Snapshot> => {
      const previous = await snapshot(queryClient);
      const readAt = new Date().toISOString();
      updateFeeds(queryClient, (items, filters) =>
        filters.unreadOnly ? [] : items.map((item) => (isUnread(item) ? asRead(item, readAt) : item)),
      );
      setCount(queryClient, () => 0);
      return previous;
    },
    onError: (_error, _variables, previous) => restore(queryClient, previous),
    onSettled: () => resync(queryClient),
  });

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation(markAllReadOptions(queryClient));
}

/**
 * DELETE /notifications/:id: dismissed, it leaves the feed and the count for
 * good. A 404 (12001) means it's gone already (dismissed in another tab), so
 * it stays out of the list instead of coming back.
 */
export const dismissOptions = (queryClient: QueryClient) =>
  mutationOptions({
    mutationFn: (id: string) => api.delete<MessageResponse>(itemPath(id)),
    onMutate: async (id): Promise<Snapshot> => {
      const previous = await snapshot(queryClient);
      const target = cached(queryClient, id);
      updateFeeds(queryClient, (items) => items.filter((item) => item.id !== id));
      if (target && isUnread(target)) setCount(queryClient, (count) => count - 1);
      return previous;
    },
    onError: (error, _id, previous) => {
      if (!isNotFound(error)) restore(queryClient, previous);
    },
    onSettled: () => resync(queryClient),
  });

export function useDismissNotification() {
  const queryClient = useQueryClient();
  return useMutation(dismissOptions(queryClient));
}
