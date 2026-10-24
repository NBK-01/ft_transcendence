export { api, configureApi, type Query, type RequestOptions, type UploadOptions } from "./client";
export {
  addMessageToCache,
  CONVERSATION_NOT_FOUND,
  MESSAGES_PAGE_SIZE,
  messagesOf,
  NOT_CONVERSATION_PARTICIPANT,
  STAFF_NOT_CONNECTED,
  useConversations,
  useLiveChat,
  useMarkConversationRead,
  useMessages,
  useOpenStaffConversation,
} from "./chat";
export {
  setChatConnectionFactory,
  useChatConnected,
  useChatConnection,
  type ChatConnection,
  type ChatEvents,
} from "./chat-socket";
export { ApiError, isApiError, isForbidden } from "./errors";
export { tokens } from "./session";
export { keys } from "./keys";
export { ApiProvider, createQueryClient } from "./query";
export {
  ACCOUNT_NOT_VERIFIED,
  EMAIL_ALREADY_REGISTERED,
  GOOGLE_EMAIL_NOT_VERIFIED,
  INVALID_CREDENTIALS,
  INVALID_RESET_TOKEN,
  OAUTH_ACCOUNT_CONFLICT,
  OAUTH_CODE_INVALID,
  OTP_INVALID,
  WRONG_AUTH_PROVIDER,
  useForgotPassword,
  useLogin,
  useLogout,
  useLogoutEverywhere,
  useMe,
  useOAuthExchange,
  useRegister,
  useResendOtp,
  useResetPassword,
  useSession,
  useSessionActions,
  useVerifyOtp,
  type SessionState,
} from "./auth";
export {
  STAFF_ACCOUNT_INACTIVE,
  STAFF_INVALID_CREDENTIALS,
  useChangeStaffPassword,
  useStaffLogin,
  useStaffLogout,
  useStaffLogoutEverywhere,
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
