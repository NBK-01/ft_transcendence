import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import type { ChatConnection } from "./chat-socket";
import { api } from "./client";
import { keys } from "./keys";
import type { ContactPresence } from "./types";

/**
 * Whether a staff member's accepted contacts are online: a snapshot
 * (GET /contacts/presence), kept current by the socket's `presence.changed`
 * (useLivePresence). Only contacts see each other's status. Under
 * keys.contacts, so a contact accepted or removed refreshes it too.
 */
export function useContactPresence({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.contacts.presence(),
    queryFn: ({ signal }) => api.get<ContactPresence[]>("/contacts/presence", { signal }),
    enabled,
    // Contact id → online. Anyone missing isn't an accepted contact: show no status for them.
    select: (rows) => new Map(rows.map((row) => [row.internalUserId, row.online])),
  });
}

/**
 * Applies `presence.changed` to the snapshot as contacts come and go, and
 * fetches a fresh snapshot after a reconnect (for what changed while it was down).
 * Mount it once, with the tab's connection (useChatConnection).
 */
export function useLivePresence(connection: ChatConnection | null) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!connection) return;
    const offChanged = connection.on("presence.changed", ({ accountId, accountType, online }) => {
      if (accountType !== "staff") return;
      queryClient.setQueryData<ContactPresence[]>(keys.contacts.presence(), (rows) =>
        rows?.map((row) => (row.internalUserId === accountId ? { ...row, online } : row)),
      );
    });
    let reconnect = connection.connected;
    const offConnect = connection.on("connect", () => {
      if (reconnect) void queryClient.invalidateQueries({ queryKey: keys.contacts.presence() });
      reconnect = true;
    });
    return () => {
      offChanged();
      offConnect();
    };
  }, [connection, queryClient]);
}
