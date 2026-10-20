import type { ApiErrorBody } from "./types";

/**
 * Thrown by every API call that doesn't succeed.
 *  - kind "http": the server answered with an error (`messages` are translated server-side).
 *  - kind "network": no answer (offline, server down, CORS). Show a generic "try again" message.
 */
export class ApiError extends Error {
  readonly kind: "http" | "network";
  readonly status: number;
  readonly messages: string[];
  readonly errorCode?: number;
  readonly traceId?: string;

  constructor(kind: "http" | "network", status: number, body?: Partial<ApiErrorBody>) {
    const messages = body?.messages?.length ? body.messages : [];
    super(messages[0] ?? `Request failed (${kind}${status ? ` ${status}` : ""})`);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.messages = messages;
    this.errorCode = body?.errorCode;
    this.traceId = body?.traceId;
  }

  /** 4xx: the request itself is wrong — retrying won't help. */
  get isClientError() {
    return this.kind === "http" && this.status >= 400 && this.status < 500;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** 403: signed in, but this account may not do it (its role, or a role change since signing in). */
export function isForbidden(error: unknown) {
  return isApiError(error) && error.status === 403;
}
