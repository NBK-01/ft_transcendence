import { internalUsers } from "./data";

/**
 * Who's online in the mock world (backend PresenceService, which reads Redis).
 * A few colleagues are online from the start; while a mock socket is
 * connected, one of them comes and goes now and then (chat.ts), so the dots
 * can be seen changing.
 */
const online = new Set(
  ["Rami Khoury", "Youssef Benali", "Maya Azar"].map((name) => internalUsers.find((user) => user.name === name)!.id),
);

export const isOnline = (internalUserId: string) => online.has(internalUserId);

/** Flips someone's presence; returns whether they're online now. */
export function togglePresence(internalUserId: string) {
  if (online.delete(internalUserId)) return false;
  online.add(internalUserId);
  return true;
}
