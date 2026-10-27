import type { TokenPair } from "./types";

/**
 * Token storage.
 *  - Access token: memory only (short-lived, 15 min). Lost on reload — the
 *    client silently refreshes it on the next request.
 *  - Refresh token: localStorage, so a reload keeps you signed in.
 *  - User: optional, next to the refresh token, for sessions whose API has no
 *    /me to reload it from (staff). Cleared with the tokens.
 *
 * Each app keeps its own storage key (see `configureApi`), so a customer and a
 * staff session on the same origin never mix.
 *
 * If the backend later sets the refresh token as an httpOnly cookie, only this
 * file (and the refresh call in client.ts) needs to change.
 */

let refreshKey = "trans-refresh-token";
const userKey = () => `${refreshKey}:user`;

let accessToken: string | null = null;
const listeners = new Set<() => void>();

/** Called by configureApi. Changing the key starts from a signed-out state. */
export function setStorageKey(key: string) {
  refreshKey = key;
  accessToken = null;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    // Storage blocked (private mode): the session lasts until reload.
  }
}

// useSyncExternalStore needs the same object back while the stored value hasn't changed.
let userCache: { raw: string | null; value: unknown } = { raw: null, value: null };

function readUser(): unknown {
  const raw = read(userKey());
  if (raw !== userCache.raw) userCache = { raw, value: parse(raw) };
  return userCache.value;
}

function parse(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export const tokens = {
  getAccess: () => accessToken,
  getRefresh: () => read(refreshKey),
  /** True when there's anything to authenticate with (even an expired access token). */
  hasSession: () => accessToken !== null || read(refreshKey) !== null,
  /** The user stored with `set`, or null. Same object until it changes. */
  getUser: <T>() => readUser() as T | null,
  /** `user` is kept until `clear`; a refresh passes only the new pair and keeps it. */
  set(pair: TokenPair, user?: unknown) {
    accessToken = pair.accessToken;
    write(refreshKey, pair.refreshToken);
    if (user !== undefined) write(userKey(), JSON.stringify(user));
    emit();
  },
  /** Replaces the stored user, keeping the tokens (e.g. after a rename). */
  setUser(user: unknown) {
    write(userKey(), JSON.stringify(user));
    emit();
  },
  clear() {
    accessToken = null;
    write(refreshKey, null);
    write(userKey(), null);
    emit();
  },
  /** For useSyncExternalStore: re-render when tokens change. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
