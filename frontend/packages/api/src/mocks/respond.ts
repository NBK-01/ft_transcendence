import { HttpResponse } from "msw/http";

import type { ApiErrorBody, PaginationMeta, SuccessEnvelope } from "../types";

/** A success response, enveloped like the backend's ResponseInterceptor. */
export const ok = <T>(data: T, statusCode = 200) =>
  HttpResponse.json({ success: true, statusCode, data } satisfies SuccessEnvelope<T>, { status: statusCode });

/** One page of a list, enveloped with `meta` like the backend's PaginatedResponseDto. */
export const paginated = <T>(all: T[], page = 1, limit = 20) => {
  const meta: PaginationMeta = {
    page,
    limit,
    totalItems: all.length,
    totalPages: Math.max(1, Math.ceil(all.length / limit)),
  };
  return HttpResponse.json({
    success: true,
    statusCode: 200,
    data: all.slice((page - 1) * limit, page * limit),
    meta,
  } satisfies SuccessEnvelope<T[]>);
};

/** An error response, shaped like the backend's GlobalExceptionFilter (never enveloped). */
export const error = (statusCode: number, messages: string[], errorCode?: number) =>
  HttpResponse.json(
    {
      statusCode,
      messages,
      errorCode,
      timestamp: new Date().toISOString(),
      traceId: "mock",
    } satisfies ApiErrorBody,
    { status: statusCode },
  );
