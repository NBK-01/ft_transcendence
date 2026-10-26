export { api, configureApi, type Query, type RequestOptions, type UploadOptions } from "./client";
export {
  ATTACHMENT_KINDS,
  FILE_TOO_LARGE,
  INVALID_FILE_TYPE,
  INVALID_SHIPMENT_STATE,
  LIVE_STATES,
  MAX_OFFER_IMAGES,
  MAX_SHIPMENT_FILE_BYTES,
  SHIPMENT_FILE_TYPES,
  SHIPMENT_IMAGE_TYPES,
  SHIPMENT_NOT_FOUND,
  TOO_MANY_SHIPMENT_IMAGES,
  TRACKING_TRANSITIONS,
  trackingMovesFrom,
  useAddShipmentEvent,
  useAdminShipment,
  useAdminShipmentEvents,
  useAdminShipmentFiles,
  useAdminShipments,
  useConfirmShipmentPayment,
  useSendShipmentOffer,
  useUploadShipmentFile,
} from "./admin-shipments";
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
  useSupportConversation,
} from "./chat";
export {
  setChatConnectionFactory,
  useChatConnected,
  useChatConnection,
  type ChatConnection,
  type ChatEvents,
} from "./chat-socket";
export {
  NOTIFICATION_NOT_FOUND,
  notificationListOptions,
  NOTIFICATIONS_PAGE_SIZE,
  notificationsOf,
  UNREAD_COUNT_REFETCH_MS,
  unreadCountOptions,
  useDismissNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "./notifications";
export {
  API_KEY_BRANCH_INACTIVE,
  API_KEY_NOT_FOUND,
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "./api-keys";
export { ApiError, isApiError, isForbidden } from "./errors";
export { tokens } from "./session";
export { keys } from "./keys";
export { ApiProvider, createQueryClient } from "./query";
export {
  ACCOUNT_DEACTIVATED,
  ACCOUNT_NOT_VERIFIED,
  EMAIL_ALREADY_REGISTERED,
  GOOGLE_EMAIL_NOT_VERIFIED,
  INVALID_CREDENTIALS,
  INVALID_RESET_TOKEN,
  OAUTH_ACCOUNT_CONFLICT,
  OAUTH_CODE_INVALID,
  OTP_INVALID,
  WRONG_AUTH_PROVIDER,
  useChangePassword,
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
