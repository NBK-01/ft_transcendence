/**
 * Request / response shapes shared with the backend (NestJS, /api).
 * Hand-written until the backend's Swagger declares response types — then
 * switch to generated types (openapi-typescript) and delete these.
 */

/** Sent by paginated list endpoints (backend PaginatedResponseDto). */
export type PaginationMeta = {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
};

/**
 * Every 2xx response from the backend's ResponseInterceptor. The client
 * unwraps it, so callers only see `data` (or `{ items, meta }` via api.getPage).
 */
export type SuccessEnvelope<T> = {
  success: true;
  statusCode: number;
  data: T;
  meta?: PaginationMeta;
};

/** What api.getPage returns for a paginated list. */
export type Page<T> = {
  items: T[];
  meta: PaginationMeta;
};

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
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Returned by POST /auth/login and POST /auth/verify-otp. `user` is a short
 * summary, not the full `User`: read that from GET /auth/me.
 */
export type AuthResponse = TokenPair & { user: Pick<User, "id" | "email" | "name"> };

/** POST /auth/register body. No session starts from this: the account is unverified until the OTP step. */
export type RegisterInput = { email: string; password: string; name: string };

/** POST /auth/verify-otp body. Completes registration and returns an AuthResponse. */
export type VerifyOtpInput = { email: string; otp: string };

/** POST /auth/resend-otp body. */
export type ResendOtpInput = { email: string };

/** POST /auth/forgot-password body. Always succeeds, whether or not the email exists. */
export type ForgotPasswordInput = { email: string };

/** POST /auth/reset-password body. The token comes from the emailed link, single use, 15 min TTL. */
export type ResetPasswordInput = { token: string; newPassword: string };

/** POST /auth/oauth/exchange body. `code` is the one-time code from the /auth/oauth-callback redirect. */
export type OAuthExchangeInput = { code: string };

/** POST /auth/login body. */
export type LoginInput = { email: string; password: string };

/** POST /auth/change-password body. A wrong currentPassword is 401 with code 2002. */
export type ChangePasswordInput = { currentPassword: string; newPassword: string };

/**
 * The signed-in staff member, as POST /staff-auth/login returns it. There's no
 * staff /me yet, so this is stored with the session and only updates on the next sign-in.
 */
export type StaffUser = {
  id: string;
  email: string;
  name: string;
  /** "admin" | "dispatcher" | "driver" | "support", or null if unassigned. */
  roleName: string | null;
};

/** POST /staff-auth/login body. */
export type StaffLoginInput = { email: string; password: string };

/** POST /staff-auth/change-password body. A wrong `currentPassword` is 401 with code 8003. */
export type StaffChangePasswordInput = { currentPassword: string; newPassword: string };

/** Returned by POST /staff-auth/login. */
export type StaffAuthResponse = TokenPair & { user: StaffUser };

/** A contact's state (backend ContactStatus). A rejected request is deleted, not kept. */
export type ContactStatus = "pending" | "accepted" | "blocked";

/**
 * A connection between two staff members (backend ContactDto). Staff can only
 * message their accepted contacts. The block doesn't record who blocked.
 */
export type Contact = {
  id: string;
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  addresseeId: string;
  addresseeName: string;
  addresseeEmail: string;
  status: ContactStatus;
  createdAt: string;
  updatedAt: string;
};

/** Who's on the other end of a chat event (backend AccountType). */
export type AccountType = "staff" | "customer";

/** Staff-to-staff, or a customer's support conversation (backend ConversationType). */
export type ConversationType = "staff_dm" | "support";

/**
 * A conversation (backend ConversationDto). A staff DM has `participantAId` and
 * `participantBId` (staff ids, sorted); a support conversation has `customerId`.
 * There are no names, last message or unread count yet: the app fills in what it can.
 */
export type Conversation = {
  id: string;
  type: ConversationType;
  customerId?: string | null;
  participantAId?: string | null;
  participantBId?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A chat message (backend MessageDto). GET /chat/conversations/:id/messages pages them newest first. */
export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: AccountType;
  content: string;
  createdAt: string;
};

/** Socket event `support.message.new`, sent to everyone with support access. */
export type SupportMessageEvent = { conversationId: string; preview: string };

/** Socket event `presence.changed`. */
export type PresenceEvent = { accountId: string; accountType: AccountType; online: boolean };

/** Returned by endpoints that only confirm an action. */
export type MessageResponse = { message: string };

/** A staff account (backend InternalUserDto). GET /internal-users is admin-only. */
export type InternalUser = {
  id: string;
  email: string;
  name: string;
  /** Deactivated accounts can't sign in; there is no hard delete. */
  isActive: boolean;
  /** "admin" | "dispatcher" | "driver" | "support", or null if unassigned. */
  roleName: string | null;
  /** The branch (organization) the account belongs to, if any. */
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
};

/** POST /internal-users body (backend CreateInternalUserDto). */
export type CreateInternalUserInput = {
  email: string;
  password: string;
  name: string;
  roleName: string;
  organizationId?: string;
};

/** PATCH /internal-users/:id body (backend UpdateInternalUserDto). Email and password can't change here. */
export type UpdateInternalUserInput = Partial<{
  name: string;
  roleName: string;
  organizationId: string | null;
  isActive: boolean;
}>;

/** GET /access-control/roles */
export type Role = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

/** A branch (backend OrganizationDto). GET /organizations */
export type Organization = {
  id: string;
  name: string;
  description: string | null;
  contactEmail: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

/** POST /organizations body (backend CreateOrganizationDto). Names are unique (409, code 4002). */
export type CreateOrganizationInput = {
  name: string;
  description?: string;
  contactEmail?: string;
};

/** PATCH /organizations/:id body (backend UpdateOrganizationDto). null clears a field. */
export type UpdateOrganizationInput = Partial<{
  name: string;
  description: string | null;
  contactEmail: string | null;
  isActive: boolean;
}>;
