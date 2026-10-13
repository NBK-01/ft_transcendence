import { ApiError } from "./errors";
import { tokens } from "./session";
import type { ApiErrorBody, TokenPair } from "./types";

type ApiConfig = {
  /** Prefix for every path. "/api" in dev (Vite proxy) and prod (nginx). */
  baseUrl: string;
  /** Sent as Accept-Language so backend error messages come back translated. */
  getLanguage: () => string;
  /** Called once the session is definitely gone (refresh failed). Redirect to login here. */
  onSessionExpired: () => void;
};

const config: ApiConfig = {
  baseUrl: "/api",
  getLanguage: () => (typeof document === "undefined" ? "en" : document.documentElement.lang || "en"),
  onSessionExpired: () => {},
};

/** Call once at app start-up (main.tsx). */
export function configureApi(options: Partial<ApiConfig>) {
  Object.assign(config, options);
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
 * ------------------------------------------------------------------------ */
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = tokens.getRefresh();
    if (!refreshToken) return false;
    try {
      const response = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      tokens.set((await response.json()) as TokenPair);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

function expireSession() {
  tokens.clear();
  config.onSessionExpired();
}

/* ---------------------------------------------------------------------------
 * Request
 * ------------------------------------------------------------------------ */
async function request<T>(method: string, path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
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
    if (!isRetry && (await refreshSession())) {
      return request<T>(method, path, options, true);
    }
    expireSession();
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
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
    if (!isRetry && (await refreshSession())) return upload<T>(path, form, options, true);
    expireSession();
  }
  if (status < 200 || status >= 300) throw new ApiError("http", status, data as Partial<ApiErrorBody>);
  return data as T;
}

/* ---------------------------------------------------------------------------
 * Public surface
 * ------------------------------------------------------------------------ */
export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("GET", path, options),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...options, body }),
  delete: <T = void>(path: string, options?: Omit<RequestOptions, "body">) => request<T>("DELETE", path, options),
  upload,
};
