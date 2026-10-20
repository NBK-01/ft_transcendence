export { api, configureApi, type Query, type RequestOptions, type UploadOptions } from "./client";
export { ApiError, isApiError, isForbidden } from "./errors";
export { tokens } from "./session";
export { keys } from "./keys";
export { ApiProvider, createQueryClient } from "./query";
export { useMe, useSession, useSessionActions, type SessionState } from "./auth";
export {
  STAFF_ACCOUNT_INACTIVE,
  STAFF_INVALID_CREDENTIALS,
  useStaffLogin,
  useStaffLogout,
  useStaffSession,
  type StaffSessionState,
} from "./staff-auth";
export {
  INSUFFICIENT_PERMISSIONS,
  ROLE_PERMISSIONS,
  roleCan,
  useStaffAccess,
  type Permission,
  type StaffRole,
} from "./permissions";
export type * from "./types";
