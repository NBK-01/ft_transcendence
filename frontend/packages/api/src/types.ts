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

/** GET /staff-auth/me (backend StaffMeDto): the signed-in staff member as they are now. */
export type StaffMe = StaffUser & {
  organizationId: string | null;
  organization: { id: string; name: string; isActive: boolean } | null;
  /** Their role's permissions (an admin passes every check anyway). */
  permissions: string[];
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

/** Socket event `support.message.new`: a message in a support conversation (never a staff DM), sent to everyone with support access. */
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

/**
 * Everything a shipment's `status` can be (backend ShipmentState): four order
 * stages, then the tracking statuses. Nothing sets "requested" today; it's kept
 * for parity. Same strings as ShipmentState in packages/ui/src/blocks/shipment-state.tsx,
 * written out again because packages/api doesn't depend on packages/ui. Keep the three in sync.
 */
export type ShipmentState =
  | "pending_sourcing"
  | "pending_client_decision"
  | "pending_payment"
  | "pending_payment_confirmation"
  | "requested"
  | "confirmed"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

/** An amount of money (backend MoneyDto). */
export type Money = {
  amount: number;
  /** ISO 4217, e.g. "EUR". */
  currency: string;
};

/** A stored image (backend ImageRefDto). `url` is signed and expires after an hour: refetch rather than keep it. */
export type ImageRef = {
  id: string;
  url: string;
  name: string;
};

/** A sender or recipient (backend AddressDto): in the shipment detail, and in the payment confirmation body. */
export type Address = {
  name: string;
  street: string;
  city: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "FR". */
  country: string;
  phone?: string;
};

/** A row of a shipments list (backend ShipmentDto). */
export type Shipment = {
  /** e.g. "TRK-4A6F90". Always upper case; the API matches it case-insensitively. */
  trackingId: string;
  /** Origin and destination cities: null until the payment is confirmed and the route set. */
  origin: string | null;
  destination: string | null;
  status: ShipmentState;
  updatedAt: string;
};

/** What the client asked for: a product link or photos, never both (backend ShipmentRequestDto). */
export type ShipmentRequest = {
  productUrl: string | null;
  images: ImageRef[];
};

/** The supplier offer the client decides on (backend SupplierOfferDto). Rejected offers aren't returned. */
export type SupplierOffer = {
  supplierName: string;
  /** Price of one unit. */
  unitPrice: Money;
  images: ImageRef[];
  note: string | null;
  offeredAt: string;
};

/** What the client paid at checkout (backend PaymentSummaryDto). Never more of the card than its last 4 digits. */
export type PaymentSummary = {
  quantity: number;
  total: Money;
  cardLast4: string;
  submittedAt: string;
};

/** One shipment with everything its page shows (backend ShipmentDetailDto). */
export type ShipmentDetail = Shipment & {
  request: ShipmentRequest;
  /** The newest offer not rejected: present from pending_client_decision on. */
  offer: SupplierOffer | null;
  /** Present from pending_payment_confirmation on. */
  payment: PaymentSummary | null;
  /** Sender, recipient and weight are set when the payment is confirmed; null until then. */
  sender: Address | null;
  recipient: Address | null;
  weightKg: number | null;
  /** The payment's total, once the order is live (LIVE_STATES, cancelled included); otherwise null. */
  declaredValue: Money | null;
};

/** The client who ordered a shipment (backend ShipmentClientDto). */
export type ShipmentClient = {
  id: string;
  name: string;
  email: string;
};

/** A row of GET /admin/shipments (backend AdminShipmentDto): who ordered it and when. */
/**
 * The branch handling a shipment (backend ShipmentBranchDto). Only shipments a
 * partner created through the public API have one; customer requests don't.
 */
export type ShipmentBranch = {
  id: string;
  name: string;
};

export type AdminShipment = Shipment & {
  client: ShipmentClient;
  organization: ShipmentBranch | null;
  createdAt: string;
};

/** GET /admin/shipments/:trackingId (backend AdminShipmentDetailDto); also what every admin status change returns. */
export type AdminShipmentDetail = ShipmentDetail & {
  client: ShipmentClient;
  organization: ShipmentBranch | null;
  createdAt: string;
};

/** Who moved a shipment (backend ShipmentActorType). */
export type ShipmentActorType = "customer" | "staff" | "partner" | "carrier";

/** Who did a shipment event (backend ActivityActorDto). */
export type ActivityActor = {
  type: ShipmentActorType;
  /** A customer's, a staff member's or an API key's id; null for the carrier. */
  id: string | null;
  /** The person's name, or the API key's for a partner; null for the carrier, or an account that's gone. */
  name: string | null;
  /** A partner's branch (its API key's); null otherwise. */
  organization: ShipmentBranch | null;
};

/** One shipment event with who did it (backend ActivityDto). */
export type ShipmentActivity = {
  id: string;
  trackingId: string;
  status: ShipmentState;
  location: string;
  occurredAt: string;
  /** Null on events from before who did it was recorded. */
  actor: ActivityActor | null;
};

/** A number for the period asked, and for the one just before it. */
export type PeriodCount = { current: number; previous: number };

/** GET /admin/stats/overview (backend OverviewStatsDto). */
export type OverviewStats = {
  period: { from: string; to: string; previousFrom: string };
  /** Shipments created in the period: customer requests and partner ones. */
  created: PeriodCount;
  delivered: PeriodCount;
  /** How many shipments are in each status now. */
  byStatus: Record<ShipmentState, number>;
  /** The latest events, newest first, whatever the period. */
  recentActivity: ShipmentActivity[];
};

/** GET /admin/stats/overview's query (backend OverviewStatsQueryDto). */
export type OverviewStatsQuery = {
  /** ISO 8601 with the browser's offset, so "today" is the user's day. Included. */
  from: string;
  /** After `from`, at most 366 days later. Excluded. */
  to: string;
  /** One branch only. Customer orders have no branch, so they never count. */
  organizationId?: string;
};

/** One step of a shipment's timeline (backend ShipmentEventDto). The API lists them newest first. */
export type ShipmentEvent = {
  status: ShipmentState;
  /** Where it happened, or a short note, e.g. "Lyon hub" or "Offer approved". */
  location: string;
  occurredAt: string;
};

/** What a Files-tab attachment is (backend AttachmentKind). Request and offer photos come as ImageRefs instead. */
export type AttachmentKind = "package_photo" | "proof_of_delivery" | "other";

/** A Files-tab attachment (backend ShipmentFileDto). The API lists them newest first. */
export type ShipmentFile = {
  id: string;
  /** The original file name. */
  name: string;
  kind: AttachmentKind;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  /** Signed, valid for an hour. */
  url: string;
};

/** GET /admin/shipments query (backend ListShipmentsQueryDto). */
export type AdminShipmentFilters = {
  /** Part of a tracking ID, any case (up to 50 characters). */
  q?: string;
  status?: ShipmentState;
  /** One branch's shipments only. Customer requests have no branch, so they never match. */
  organizationId?: string;
  page?: number;
  /** 1–100, 20 by default. */
  limit?: number;
};

/** POST /admin/shipments/:trackingId/offer, sent as multipart (backend CreateOfferDto). */
export type CreateShipmentOfferInput = {
  supplierName: string;
  /** Price of one unit, up to 2 decimals. */
  unitPrice: number;
  /** ISO 4217, e.g. "USD". */
  currency: string;
  note?: string;
  /** Up to 5 supplier photos (JPEG, PNG, WebP or GIF, 10 MB each). */
  images?: File[];
};

/** POST /admin/shipments/:trackingId/payment/confirm body (backend ConfirmPaymentDto): the route the order goes live with. */
export type ConfirmShipmentPaymentInput = {
  /** Usually the supplier. */
  sender: Address;
  /** Usually the client. */
  recipient: Address;
  /** 0.01–100,000, up to 2 decimals. */
  weightKg: number;
};

/** The statuses a tracking event can move a shipment to (backend CreateEventDto). */
export type TrackingEventStatus = "in_transit" | "out_for_delivery" | "delivered" | "cancelled";

/** POST /admin/shipments/:trackingId/events body: a tracking update, or a cancellation. */
export type AddShipmentEventInput = {
  status: TrackingEventStatus;
  /** Where it happened, or why (up to 200 characters), e.g. "Lyon hub". */
  location: string;
};

/** POST /admin/shipments/:trackingId/files, sent as multipart (backend UploadFileDto + the `file` part). */
export type UploadShipmentFileInput = {
  kind: AttachmentKind;
  /** An image or a PDF, up to 10 MB. */
  file: File;
};

/**
 * Where a notification stands (backend NotificationStatus): PENDING when it's
 * created, SENT once it's in the feed (FAILED if delivery gave up), READ once
 * read, from any of them.
 */
export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "READ";

/**
 * What a notification is about (backend NotificationType). SHIPMENT_UPDATE is
 * a new step on a shipment's timeline; the others say that something was
 * created, changed or deleted, and go to whoever it affects. Whoever did it
 * gets a record of it (`ownAction`), except for the security notices and
 * messages.
 */
export type NotificationType =
  | "SHIPMENT_UPDATE"
  /** To the other admins. */
  | "BRANCH_CREATED"
  /** Details changed or reactivated. To the other admins and the branch's staff. */
  | "BRANCH_UPDATED"
  /** Deactivated (PATCH isActive false). To the other admins and the branch's staff. */
  | "BRANCH_DEACTIVATED"
  /** Deleted (DELETE, only an empty branch). To the other admins. */
  | "BRANCH_DELETED"
  /** To the staff member added. */
  | "BRANCH_STAFF_ADDED"
  /** To the staff member removed. */
  | "BRANCH_STAFF_REMOVED"
  /** To the other admins. */
  | "STAFF_ACCOUNT_CREATED"
  /** Role, branch or name changed, or reactivated. To that staff member and the other admins. */
  | "STAFF_ACCOUNT_UPDATED"
  /** To the other admins. */
  | "STAFF_ACCOUNT_DEACTIVATED"
  /** To the addressee. */
  | "CONTACT_REQUEST_RECEIVED"
  /** To the requester. */
  | "CONTACT_REQUEST_ACCEPTED"
  /** To staff with chat:support:access. */
  | "SUPPORT_CONVERSATION_STARTED"
  /** To the shipment's customer. */
  | "SHIPMENT_FILE_ADDED"
  /** An admin handed a customer's order to a branch (or took it off one). To that branch's staff. */
  | "SHIPMENT_BRANCH_ASSIGNED"
  /** To the account's owner, even when they did it. */
  | "PASSWORD_CHANGED"
  /** An admin created a partner API key. To the other admins. */
  | "API_KEY_CREATED"
  /** An admin revoked one. To the other admins. */
  | "API_KEY_REVOKED"
  /** A customer signed up. A welcome to them, and to the admins. */
  | "CUSTOMER_REGISTERED"
  /** Profile details or photo changed. To the account's owner. */
  | "PROFILE_UPDATED"
  /** A customer closed their account. To the admins. */
  | "CUSTOMER_ACCOUNT_DEACTIVATED"
  /** "Sign out everywhere": a security notice to the account's owner. */
  | "SESSIONS_REVOKED"
  /** Only a record for whoever declined the request. */
  | "CONTACT_REQUEST_DECLINED"
  /** Only a record for whoever withdrew their request. */
  | "CONTACT_REQUEST_CANCELLED"
  /** Only a record for whoever removed the contact. */
  | "CONTACT_REMOVED"
  /** Only a record for whoever blocked the contact. */
  | "CONTACT_BLOCKED"
  /** A staff member opened a direct conversation. To the other one. */
  | "CONVERSATION_STARTED"
  /** New messages: to the other side of the conversation, at most one per sender every 10 minutes. */
  | "MESSAGE_RECEIVED";

/** SHIPMENT_UPDATE: a new step on a shipment's timeline. Link to the shipment, and word it from its status. */
export type ShipmentUpdatePayload = {
  trackingId: string;
  status: ShipmentState;
  /** A shipment created straight at `confirmed` (by a partner, through the public API): "new shipment", not "payment confirmed". */
  isNew?: true;
  /** Who moved it; missing on events from before it was recorded. */
  actorType?: ShipmentActorType;
};

/** A branch, by its name when it happened. */
export type BranchPayload = {
  organizationId: string;
  name: string;
  /** On BRANCH_STAFF_ADDED / _REMOVED: the member's name (missing on older rows). */
  staffName?: string;
};

/** A staff account. */
export type StaffAccountPayload = { internalUserId: string; name: string };

/** What a staff account update changed (backend StaffChange). */
export type StaffChange = "role" | "branch" | "name" | "reactivated";

/** Also the account as it is now, to say e.g. "your role is now Dispatcher". */
export type StaffAccountUpdatedPayload = StaffAccountPayload & {
  changed: StaffChange[];
  roleName: string | null;
  organizationId: string | null;
  organizationName: string | null;
};

/** The other person, for the reader: who sent the request, who accepted it, who they declined… */
export type ContactNotificationPayload = { contactId: string; internalUserId: string; name: string };

export type CustomerPayload = { customerId: string; name: string };

/** What changed on a profile (backend ProfileChange). */
export type ProfileChange = "details" | "avatar";

export type ProfilePayload = { change: ProfileChange };

/** A direct conversation, and the other person in it for the reader. */
export type ConversationPayload = { conversationId: string; internalUserId: string; name: string };

export type MessagePayload = { conversationId: string; conversationType: ConversationType; senderName: string };

export type SupportConversationPayload = { conversationId: string; customerName: string };

export type ShipmentFilePayload = { trackingId: string; kind: AttachmentKind; fileName: string };

/** The branch an order now belongs to; null when it was taken off one. */
export type ShipmentBranchPayload = { trackingId: string; organizationId: string | null; branchName: string | null };

/** A partner API key, masked: never the key itself. */
export type ApiKeyPayload = {
  apiKeyId: string;
  name: string;
  organizationId: string;
  branchName: string;
  maskedKey: string;
};

/** What each notification type carries in `payload` (backend NotificationPayloads). */
export type NotificationPayloads = {
  SHIPMENT_UPDATE: ShipmentUpdatePayload;
  BRANCH_CREATED: BranchPayload;
  BRANCH_UPDATED: BranchPayload;
  BRANCH_DEACTIVATED: BranchPayload;
  BRANCH_DELETED: BranchPayload;
  BRANCH_STAFF_ADDED: BranchPayload;
  BRANCH_STAFF_REMOVED: BranchPayload;
  STAFF_ACCOUNT_CREATED: StaffAccountPayload;
  STAFF_ACCOUNT_UPDATED: StaffAccountUpdatedPayload;
  STAFF_ACCOUNT_DEACTIVATED: StaffAccountPayload;
  CONTACT_REQUEST_RECEIVED: ContactNotificationPayload;
  CONTACT_REQUEST_ACCEPTED: ContactNotificationPayload;
  SUPPORT_CONVERSATION_STARTED: SupportConversationPayload;
  SHIPMENT_FILE_ADDED: ShipmentFilePayload;
  SHIPMENT_BRANCH_ASSIGNED: ShipmentBranchPayload;
  PASSWORD_CHANGED: Record<string, never>;
  API_KEY_CREATED: ApiKeyPayload;
  API_KEY_REVOKED: ApiKeyPayload;
  CUSTOMER_REGISTERED: CustomerPayload;
  PROFILE_UPDATED: ProfilePayload;
  CUSTOMER_ACCOUNT_DEACTIVATED: CustomerPayload;
  SESSIONS_REVOKED: Record<string, never>;
  CONTACT_REQUEST_DECLINED: ContactNotificationPayload;
  CONTACT_REQUEST_CANCELLED: ContactNotificationPayload;
  CONTACT_REMOVED: ContactNotificationPayload;
  CONTACT_BLOCKED: ContactNotificationPayload;
  CONVERSATION_STARTED: ConversationPayload;
  MESSAGE_RECEIVED: MessagePayload;
};

/**
 * A notification (backend NotificationDto), narrowed by `type` so `payload`
 * has the right shape. `title` and `message` are English only: the apps word
 * it in the reader's language from `type` + `payload`, and can fall back to
 * them. Named AppNotification so it doesn't hide the browser's Notification.
 */
export type AppNotification = {
  [T in NotificationType]: {
    id: string;
    type: T;
    status: NotificationStatus;
    title: string;
    message: string;
    payload: NotificationPayloads[T];
    /** The reader is the one who acted: a record of their own action ("You created…"), not news. */
    ownAction: boolean;
    createdAt: string;
    /** Null until read. */
    readAt: string | null;
  };
}[NotificationType];

/** GET /notifications query (backend ListNotificationsQueryDto). */
export type NotificationFilters = {
  /** true: only the ones not read yet. */
  unreadOnly?: boolean;
  type?: NotificationType;
  page?: number;
  /** 1–100, 20 by default. */
  limit?: number;
};

/** GET /notifications/unread-count, and PATCH /notifications/read-all (how many it marked). */
export type NotificationCount = { count: number };

/**
 * A partner API key (backend ApiKeyDto): what the admins' list shows. The key
 * itself is only ever in CreatedApiKey, once.
 */
export type ApiKey = {
  id: string;
  name: string;
  /** "stk_9f3a…c4d2": the key's start and its last four characters. */
  maskedKey: string;
  /** The branch it acts for. */
  organization: { id: string; name: string };
  /** Null once that staff account is gone. */
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  /** Updated at most once a minute; null until first used. */
  lastUsedAt: string | null;
  /** Set once; a revoked key is listed but never accepted again. */
  revokedAt: string | null;
};

/** POST /api-keys: the record, plus the full key, shown this once. */
export type CreatedApiKey = ApiKey & { key: string };

/** POST /api-keys body. */
export type CreateApiKeyInput = { name: string; organizationId: string };
