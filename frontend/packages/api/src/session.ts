import type { TokenPair } from "./types";

/**
 * Token storage.
 *  - Access token: memory only (short-lived, 15 min). Lost on reload — the
 *    client silently refreshes it on the next request.
 *  - Refresh token: localStorage, so a reload keeps you signed in.
 *
 * If the backend later sets the refresh token as an httpOnly cookie, only this
 * file (and the refresh call in client.ts) needs to change.
 */

const REFRESH_KEY = "trans-refresh-token";

let accessToken: string | null = null;
const listeners = new Set<() => void>();

function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

function writeRefresh(value: string | null) {
  try {
    if (value) localStorage.setItem(REFRESH_KEY, value);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Storage blocked (private mode): the session lasts until reload.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export const tokens = {
  getAccess: () => accessToken,
  getRefresh: readRefresh,
  /** True when there's anything to authenticate with (even an expired access token). */
  hasSession: () => accessToken !== null || readRefresh() !== null,
  set(pair: TokenPair) {
    accessToken = pair.accessToken;
    writeRefresh(pair.refreshToken);
    emit();
  },
  clear() {
    accessToken = null;
    writeRefresh(null);
    emit();
  },
  /** For useSyncExternalStore: re-render when tokens change. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
