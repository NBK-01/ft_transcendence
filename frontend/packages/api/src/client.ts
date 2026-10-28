import { ApiError } from "./errors";
import { setStorageKey, tokens } from "./session";
import type { ApiErrorBody, Page, SuccessEnvelope, TokenPair } from "./types";

type ApiConfig = {
  /** Prefix for every path. "/api" in dev (Vite proxy) and prod (nginx). */
  baseUrl: string;
  /** Sent as Accept-Language so backend error messages come back translated. */
  getLanguage: () => string;
  /** Called once the session is definitely gone (refresh failed). Redirect to login here. */
  onSessionExpired: () => void;
  /** Where to exchange the refresh token: "/auth/refresh" for customers, "/staff-auth/refresh" for staff. */
  refreshPath: string;
  /** localStorage key for this app's session, so the customer and staff apps never share one. */
  storageKey: string;
  /** Socket.IO path for chat, on the same origin (the dev server and nginx proxy it to the backend). */
  socketPath: string;
};

const config: ApiConfig = {
  baseUrl: "/api",
  getLanguage: () => (typeof document === "undefined" ? "en" : document.documentElement.lang || "en"),
  onSessionExpired: () => {},
  refreshPath: "/auth/refresh",
  storageKey: "trans-refresh-token",
  socketPath: "/socket.io",
};

/** Call once at app start-up (main.tsx). */
export function configureApi(options: Partial<ApiConfig>) {
  Object.assign(config, options);
  if (options.storageKey) setStorageKey(options.storageKey);
}

export type Query = Record<string, string | number | boolean | null | undefined>;

export type RequestOptions = {
  query?: Query;
  /** Plain objects are sent as JSON; FormData / Blob are sent as-is. */
  body?: unknown;
  signal?: AbortSignal;
  /** Set false for public endpoints (login, register…) — no token, no refresh. */
  auth?: boolean;
};

function buildUrl(path: string, query?: Query) {
  const url = `${config.baseUrl}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer ||
    typeof body === "string"
  );
}

function isEnvelope(body: unknown): body is SuccessEnvelope<unknown> {
  return typeof body === "object" && body !== null && (body as { success?: unknown }).success === true && "data" in body;
}

/**
 * The backend wraps every success as { success, statusCode, data, meta? }.
 * Callers get `data`. A body that isn't an envelope passes through unchanged.
 */
function unwrap<T>(body: unknown): T {
  return (isEnvelope(body) ? body.data : body) as T;
}

/** `{ items, meta }` from a paginated envelope. Without `meta` (an unpaginated list), the whole list is one page. */
function toPage<T>(body: unknown): Page<T> {
  const items = (isEnvelope(body) ? body.data : body) as T[];
  const meta = isEnvelope(body) ? body.meta : undefined;
  return {
    items,
    meta: meta ?? { page: 1, limit: items.length, totalItems: items.length, totalPages: 1 },
  };
}

async function parseError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | undefined;
  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    body = undefined;
  }
  return new ApiError("http", response.status, body);
}

/* ---------------------------------------------------------------------------
 * Refresh — single flight. If ten requests 401 at once, only one refresh call
 * goes out; the other nine wait for it, then retry with the new token.
 *
 * "ok": a fresh token pair is in storage (ours, or a sibling tab's — either
 * way the caller should retry). "invalid": the refresh token is genuinely
 * dead; only now is it safe to sign out. "network-error": the refresh call
 * itself failed to reach the backend, or the backend had a server error —
 * that's not proof the token is bad, so the session is left alone and the
 * caller's request just fails; it'll succeed next time the network/backend recovers.
 * ------------------------------------------------------------------------ */
type RefreshOutcome = "ok" | "invalid" | "network-error";

/**
 * Two tabs can race to refresh around the same time; the backend rotates the
 * refresh token on first use, so the loser's own attempt gets a real 401 even
 * though the session is fine — the winner already wrote a fresh pair to
 * storage (`tokens` reads localStorage live, so that's visible here
 * immediately, no cross-tab messaging needed). Rather than sign out, try
 * again with whatever's now in storage: it's almost certainly the winner's
 * still-unused token, and this attempt gets its own fresh access token out
 * of it — not just permission to reuse someone else's.
 */
async function attemptRefresh(): Promise<RefreshOutcome> {
  const refreshToken = tokens.getRefresh();
  if (!refreshToken) return "invalid";
  try {
    const response = await fetch(buildUrl(config.refreshPath), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    if (response.status >= 500) return "network-error";
    if (!response.ok) {
      if (tokens.getRefresh() !== refreshToken) return attemptRefresh();
      return "invalid";
    }
    tokens.set(unwrap<TokenPair>(await response.json()));
    return "ok";
  } catch {
    return "network-error";
  }
}

let refreshing: Promise<RefreshOutcome> | null = null;

/** Single flight. If ten requests 401 at once, only one refresh attempt runs; the other nine wait for it, then retry with the new token. */
function refreshSession(): Promise<RefreshOutcome> {
  refreshing ??= attemptRefresh().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function expireSession() {
  tokens.clear();
  config.onSessionExpired();
}

/* ---------------------------------------------------------------------------
 * For the chat socket, which signs in with the access token outside fetch.
 * ------------------------------------------------------------------------ */
export const socketPath = () => config.socketPath;
/**
 * Origin the socket connects to. baseUrl is relative ("/api") in dev and in
 * the combined-nginx deploy, where same-origin is correct (resolves to
 * location.origin, below); a standalone deploy (e.g. Railway) sets it to the
 * backend's full URL instead, and the socket must follow it there — same-
 * origin would try to open a WebSocket against the frontend's own static
 * host, which has no Socket.IO server, and just hang on "Connecting…".
 */
export const socketUrl = () => {
  const base = typeof window === "undefined" ? undefined : window.location.origin;
  try {
    return new URL(config.baseUrl, base).origin;
  } catch {
    // Relative baseUrl ("/api") with no window to resolve it against (SSR/non-browser).
    return "";
  }
};

/** Before connecting: after a reload there's only a refresh token, so get an access token first. */
export async function ensureAccessToken(): Promise<boolean> {
  if (tokens.getAccess()) return true;
  return tokens.getRefresh() ? (await refreshSession()) === "ok" : false;
}

/** The handshake refused the token (expired): get a new one, or end the session like a failed request would. */
export async function renewAccessToken(): Promise<boolean> {
  const outcome = await refreshSession();
  if (outcome === "invalid") expireSession();
  return outcome === "ok";
}

/** A 401 that ends the session even though it carries a code: the staff account was deactivated (7003). */
const SESSION_ENDING_CODES: ReadonlySet<number> = new Set([7003]);

/**
 * What a 401 means. The backend sends an expired or invalid token as a plain
 * 401 with no error code; a 401 *with* a code is the request's own answer
 * (e.g. a wrong current password on change-password) and leaves the session alone.
 */
function on401(errorCode: number | undefined): "refresh" | "end-session" | "keep-session" {
  if (errorCode === undefined) return "refresh";
  return SESSION_ENDING_CODES.has(errorCode) ? "end-session" : "keep-session";
}

/* ---------------------------------------------------------------------------
 * Request
 * ------------------------------------------------------------------------ */
/** Sends the request and returns the parsed body as-is (still enveloped). */
async function send(method: string, path: string, options: RequestOptions = {}, isRetry = false): Promise<unknown> {
  const { query, body, signal, auth = true } = options;

  // After a reload the access token is gone but the refresh token isn't:
  // refresh first instead of sending a request that's certain to 401.
  if (auth && !tokens.getAccess() && tokens.getRefresh()) {
    await refreshSession();
  }

  const headers = new Headers({ Accept: "application/json", "Accept-Language": config.getLanguage() });
  const access = tokens.getAccess();
  if (auth && access) headers.set("Authorization", `Bearer ${access}`);

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (isRawBody(body)) {
      payload = body;
    } else {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify(body);
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { method, headers, body: payload, signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError("network", 0);
  }

  if (response.status === 401 && auth) {
    const error = await parseError(response);
    const action = on401(error.errorCode);
    if (action === "refresh" && !isRetry) {
      const outcome = await refreshSession();
      if (outcome === "ok") return send(method, path, options, true);
      // A network/server error during refresh isn't proof the token is bad —
      // leave the session alone and just fail this one request.
      if (outcome === "network-error") throw error;
    }
    if (action !== "keep-session") expireSession();
    throw error;
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined;

  const text = await response.text();
  return text ? (JSON.parse(text) as unknown) : undefined;
}

async function request<T>(method: string, path: string, options?: RequestOptions): Promise<T> {
  return unwrap<T>(await send(method, path, options));
}

/* ---------------------------------------------------------------------------
 * Upload with progress (fetch can't report upload progress; XHR can).
 * Needed by the File upload module.
 * ------------------------------------------------------------------------ */
export type UploadOptions = {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
  method?: "POST" | "PUT";
};

function sendXhr(path: string, form: FormData, options: UploadOptions): Promise<{ status: number; data: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? "POST", buildUrl(path));
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Accept-Language", config.getLanguage());
    const access = tokens.getAccess();
    if (access) xhr.setRequestHeader("Authorization", `Bearer ${access}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      let data: unknown;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        data = undefined;
      }
      resolve({ status: xhr.status, data });
    };
    xhr.onerror = () => reject(new ApiError("network", 0));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(form);
  });
}

async function upload<T>(path: string, form: FormData, options: UploadOptions = {}, isRetry = false): Promise<T> {
  if (!tokens.getAccess() && tokens.getRefresh()) await refreshSession();

  const { status, data } = await sendXhr(path, form, options);

  if (status === 401) {
    const action = on401((data as Partial<ApiErrorBody> | undefined)?.errorCode);
    if (action === "refresh" && !isRetry) {
      const outcome = await refreshSession();
      if (outcome === "ok") return upload<T>(path, form, options, true);
      if (outcome === "invalid") expireSession();
    } else if (action !== "keep-session") {
      expireSession();
    }
  }
  if (status < 200 || status >= 300) throw new ApiError("http", status, data as Partial<ApiErrorBody>);
  return unwrap<T>(data);
}

/* ---------------------------------------------------------------------------
 * Public surface
 * ------------------------------------------------------------------------ */
export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("GET", path, options),
  /** For list endpoints: `{ items, meta }` with page, limit, totalItems and totalPages. */
  getPage: async <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    toPage<T>(await send("GET", path, options)),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("DELETE", path, options),
  upload,
};
