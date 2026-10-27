import { ConversationType } from '../../chat/entities/conversation.entity';
import { ShipmentActorType } from '../../shipments/constants/shipment-actor';
import {
  AttachmentKind,
  ShipmentState,
} from '../../shipments/constants/shipment-state';

/**
 * Delivery and read state of one notification row.
 *
 *   PENDING (created) → SENT (reached the user's live channel) | FAILED (gave up)
 *   → READ (the user read it; allowed from any status)
 */
export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ',
}

/**
 * What the notification is about. Frontends pick their own wording from this
 * plus `payload`. Everything but SHIPMENT_UPDATE comes from the
 * ACTION_NOTIFICATION job: something was created, changed or deleted. Who's
 * told is noted on each; whoever acted also gets a record of it
 * (ownAction), except for the security notices and messages.
 */
export enum NotificationType {
  /** A new step on a shipment's timeline (any ShipmentEvent). */
  SHIPMENT_UPDATE = 'SHIPMENT_UPDATE',
  /** To the other admins. */
  BRANCH_CREATED = 'BRANCH_CREATED',
  /** Details changed or reactivated. To the other admins and the branch's staff. */
  BRANCH_UPDATED = 'BRANCH_UPDATED',
  /** Deactivated (PATCH isActive false, or DELETE). To the other admins and the branch's staff. */
  BRANCH_DEACTIVATED = 'BRANCH_DEACTIVATED',
  /** To the staff member added. */
  BRANCH_STAFF_ADDED = 'BRANCH_STAFF_ADDED',
  /** To the staff member removed. */
  BRANCH_STAFF_REMOVED = 'BRANCH_STAFF_REMOVED',
  /** To the other admins. */
  STAFF_ACCOUNT_CREATED = 'STAFF_ACCOUNT_CREATED',
  /** Role, branch or name changed, or reactivated. To that staff member and the other admins. */
  STAFF_ACCOUNT_UPDATED = 'STAFF_ACCOUNT_UPDATED',
  /** To the other admins (the person can't sign in any more). */
  STAFF_ACCOUNT_DEACTIVATED = 'STAFF_ACCOUNT_DEACTIVATED',
  /** To the addressee. */
  CONTACT_REQUEST_RECEIVED = 'CONTACT_REQUEST_RECEIVED',
  /** To the requester. */
  CONTACT_REQUEST_ACCEPTED = 'CONTACT_REQUEST_ACCEPTED',
  /** A customer opened their support conversation. To staff with chat:support:access. */
  SUPPORT_CONVERSATION_STARTED = 'SUPPORT_CONVERSATION_STARTED',
  /** Staff attached a file to a shipment. To its customer. */
  SHIPMENT_FILE_ADDED = 'SHIPMENT_FILE_ADDED',
  /** A security notice to the account's owner, even when they did it themselves. */
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  /** An admin created a partner API key. To the other admins. */
  API_KEY_CREATED = 'API_KEY_CREATED',
  /** An admin revoked one. To the other admins. */
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  /** A customer signed up (email or Google). A welcome to them, and to the admins. */
  CUSTOMER_REGISTERED = 'CUSTOMER_REGISTERED',
  /** Profile details or photo changed. To the account's owner. */
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  /** A customer closed their account. To the admins. */
  CUSTOMER_ACCOUNT_DEACTIVATED = 'CUSTOMER_ACCOUNT_DEACTIVATED',
  /** "Sign out everywhere": a security notice to the account's owner. */
  SESSIONS_REVOKED = 'SESSIONS_REVOKED',
  /** The addressee declined a request. Only a record for them: the requester isn't told. */
  CONTACT_REQUEST_DECLINED = 'CONTACT_REQUEST_DECLINED',
  /** The requester withdrew a request. Only a record for them. */
  CONTACT_REQUEST_CANCELLED = 'CONTACT_REQUEST_CANCELLED',
  /** A contact (or a block) was removed. Only a record for whoever removed it. */
  CONTACT_REMOVED = 'CONTACT_REMOVED',
  /** A contact was blocked. Only a record for whoever blocked it. */
  CONTACT_BLOCKED = 'CONTACT_BLOCKED',
  /** A staff member opened a direct conversation. To the other one. */
  CONVERSATION_STARTED = 'CONVERSATION_STARTED',
  /**
   * New messages in a conversation: to the other participant, or for a
   * support conversation, the customer or the support staff. At most one
   * per sender, conversation and recipient every 10 minutes.
   */
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
}

export interface ShipmentUpdatePayload {
  trackingId: string;
  status: ShipmentState;
  /** Set on a shipment created straight at `confirmed` (by a partner): "new shipment", not "payment confirmed". */
  isNew?: true;
  /** Who moved it; missing on events from before it was recorded. */
  actorType?: ShipmentActorType;
}

export interface BranchPayload {
  organizationId: string;
  name: string;
  /** On BRANCH_STAFF_ADDED / _REMOVED: the member's name (missing on older rows). */
  staffName?: string;
}

export interface StaffAccountPayload {
  internalUserId: string;
  name: string;
}

/** What a staff account update changed. */
export type StaffChange = 'role' | 'branch' | 'name' | 'reactivated';

/** Also the account as it is now, so a frontend can say "your role is now …". */
export interface StaffAccountUpdatedPayload extends StaffAccountPayload {
  changed: StaffChange[];
  roleName: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

/** The other person, for the reader: who sent the request, who accepted it, who they declined… */
export interface ContactPayload {
  contactId: string;
  internalUserId: string;
  name: string;
}

export interface SupportConversationPayload {
  conversationId: string;
  customerName: string;
}

export interface ShipmentFilePayload {
  trackingId: string;
  kind: AttachmentKind;
  fileName: string;
}

export interface CustomerPayload {
  customerId: string;
  name: string;
}

/** What changed on a profile. */
export type ProfileChange = 'details' | 'avatar';

export interface ProfilePayload {
  change: ProfileChange;
}

/** A direct conversation, and the other person in it for the reader. */
export interface ConversationPayload {
  conversationId: string;
  internalUserId: string;
  name: string;
}

export interface MessagePayload {
  conversationId: string;
  conversationType: ConversationType;
  senderName: string;
}

/** A partner API key, as the admins' list shows it (masked: never the key itself). */
export interface ApiKeyPayload {
  apiKeyId: string;
  name: string;
  organizationId: string;
  branchName: string;
  maskedKey: string;
}

/**
 * What each type carries in `payload`: enough for a frontend to word the
 * notification in its own language and link to the thing it's about. The
 * stored title/message are English only (the backend has no other locale).
 */
export interface NotificationPayloads {
  [NotificationType.SHIPMENT_UPDATE]: ShipmentUpdatePayload;
  [NotificationType.BRANCH_CREATED]: BranchPayload;
  [NotificationType.BRANCH_UPDATED]: BranchPayload;
  [NotificationType.BRANCH_DEACTIVATED]: BranchPayload;
  [NotificationType.BRANCH_STAFF_ADDED]: BranchPayload;
  [NotificationType.BRANCH_STAFF_REMOVED]: BranchPayload;
  [NotificationType.STAFF_ACCOUNT_CREATED]: StaffAccountPayload;
  [NotificationType.STAFF_ACCOUNT_UPDATED]: StaffAccountUpdatedPayload;
  [NotificationType.STAFF_ACCOUNT_DEACTIVATED]: StaffAccountPayload;
  [NotificationType.CONTACT_REQUEST_RECEIVED]: ContactPayload;
  [NotificationType.CONTACT_REQUEST_ACCEPTED]: ContactPayload;
  [NotificationType.SUPPORT_CONVERSATION_STARTED]: SupportConversationPayload;
  [NotificationType.SHIPMENT_FILE_ADDED]: ShipmentFilePayload;
  [NotificationType.PASSWORD_CHANGED]: Record<string, never>;
  [NotificationType.API_KEY_CREATED]: ApiKeyPayload;
  [NotificationType.API_KEY_REVOKED]: ApiKeyPayload;
  [NotificationType.CUSTOMER_REGISTERED]: CustomerPayload;
  [NotificationType.PROFILE_UPDATED]: ProfilePayload;
  [NotificationType.CUSTOMER_ACCOUNT_DEACTIVATED]: CustomerPayload;
  [NotificationType.SESSIONS_REVOKED]: Record<string, never>;
  [NotificationType.CONTACT_REQUEST_DECLINED]: ContactPayload;
  [NotificationType.CONTACT_REQUEST_CANCELLED]: ContactPayload;
  [NotificationType.CONTACT_REMOVED]: ContactPayload;
  [NotificationType.CONTACT_BLOCKED]: ContactPayload;
  [NotificationType.CONVERSATION_STARTED]: ConversationPayload;
  [NotificationType.MESSAGE_RECEIVED]: MessagePayload;
}

export type NotificationPayload = NotificationPayloads[NotificationType];
