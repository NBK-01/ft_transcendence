/**
 * Request / response shapes shared with the backend (NestJS, /api).
 * Hand-written until the backend's Swagger declares response types — then
 * switch to generated types (openapi-typescript) and delete these.
 */

/** Every non-2xx response from the backend's GlobalExceptionFilter. */
export type ApiErrorBody = {
  statusCode: number;
  /** Already translated by the backend (from Accept-Language). */
  messages: string[];
  /** Domain error code, e.g. 2002 = invalid credentials. Absent for validation errors. */
  errorCode?: number;
  traceId?: string;
  path?: string;
  timestamp?: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/** Returned by POST /auth/login and POST /auth/verify-otp. */
export type AuthResponse = TokenPair & { user: User };

/** Returned by endpoints that only confirm an action. */
export type MessageResponse = { message: string };
