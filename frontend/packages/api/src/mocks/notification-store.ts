import { roleCan, type Permission } from "../permissions";
import type {
  AccountType,
  ApiKeyPayload,
  AppNotification,
  AttachmentKind,
  InternalUser,
  NotificationPayloads,
  NotificationType,
  ShipmentState,
  StaffChange,
} from "../types";
import { internalUsers, ORGANIZATIONS } from "./data";

/**
 * The mock notifications and the two rules that create them, like the
 * backend's jobs: notifyShipmentEvent (SHIPMENT_EVENT_NOTIFICATION) and
 * notifyAction (ACTION_NOTIFICATION). The mocks that change things call
 * them; notifications.ts serves the rows. Kept apart from the HTTP handlers
 * so any mock can import it without an import cycle.
 */

export type Row = AppNotification & {
  userId: string;
  accountType: AccountType;
  sentAt: string | null;
  dismissedAt: string | null;
};

export const rows: Row[] = [];

/** An account: who acted, or who's told. */
export type Who = { id: string; accountType: AccountType };

type Copy = readonly [title: string, message: string];

type When = {
  /** When it happened; now by default. */
  at?: string;
  /** Seed data the recipient has opened since. */
  read?: boolean;
};

let ids = 0;
const nextId = () => `00000000-0000-4000-5000-${String(++ids).padStart(12, "0")}`;

const fill = (text: string, args: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, name: string) => args[name] ?? "");

function push(recipient: Who, type: NotificationType, payload: unknown, [title, message]: Copy, { at, read = false }: When) {
  const createdAt = at ?? new Date().toISOString();
  rows.push({
    id: nextId(),
    userId: recipient.id,
    accountType: recipient.accountType,
    type,
    status: read ? "READ" : "SENT",
    title,
    message,
    payload,
    createdAt,
    sentAt: createdAt,
    readAt: read ? new Date(Date.parse(createdAt) + 3_600_000).toISOString() : null,
    dismissedAt: null,
  } as Row);
}

/** Active staff whose role has `permission`, as their role is now (the backend reads the role → permission table). */
const staffWith = (permission: Permission): Who[] =>
  internalUsers
    .filter((user) => user.isActive && roleCan(user.roleName, permission))
    .map((user) => ({ id: user.id, accountType: "staff" }));

/* ---------------------------------------------------------------------------
 * Shipment events (backend SHIPMENT_EVENT_NOTIFICATION)
 * ------------------------------------------------------------------------ */

/**
 * Who hears about each status: the side that didn't cause it (backend
 * AUDIENCE_BY_STATUS). Customer actions go to staff, staff actions to the customer.
 */
const AUDIENCE_BY_STATUS: Record<ShipmentState, AccountType | null> = {
  pending_sourcing: "staff",
  pending_client_decision: "customer",
  pending_payment: "staff",
  pending_payment_confirmation: "staff",
  requested: null,
  confirmed: "customer",
  in_transit: "customer",
  out_for_delivery: "customer",
  delivered: "customer",
  cancelled: "customer",
};

/** The backend's English copy (backend/src/i18n/en/notifications.json). */
const SHIPMENT_COPY: Record<AccountType, Partial<Record<ShipmentState, Copy>>> = {
  customer: {
    pending_client_decision: [
      "Your offer is ready",
      "We found a supplier for {trackingId}. Review the offer to accept or reject it.",
    ],
    confirmed: ["Payment confirmed", "Your payment for {trackingId} is confirmed. We'll let you know when it ships."],
    in_transit: ["In transit", "{trackingId} is on its way."],
    out_for_delivery: ["Out for delivery", "{trackingId} is out for delivery."],
    delivered: ["Delivered", "{trackingId} has been delivered."],
    cancelled: ["Shipment cancelled", "{trackingId} has been cancelled."],
  },
  staff: {
    pending_sourcing: ["Needs a supplier", "{trackingId} is waiting for a supplier offer."],
    pending_payment: ["Offer accepted", "The client accepted the offer for {trackingId}. Waiting for their payment."],
    pending_payment_confirmation: [
      "Payment to confirm",
      "The client paid for {trackingId}. Confirm the payment to start the shipment.",
    ],
  },
};

export type NotifiedShipmentEvent = {
  trackingId: string;
  /** The shipment's customer. */
  clientId: string;
  status: ShipmentState;
  occurredAt: string;
};

/** What the backend's job does for a committed shipment event: one row per recipient, already delivered (SENT). */
export function notifyShipmentEvent(event: NotifiedShipmentEvent, { read = false }: { read?: boolean } = {}) {
  const audience = AUDIENCE_BY_STATUS[event.status];
  const copy = audience && SHIPMENT_COPY[audience][event.status];
  if (!audience || !copy) return;

  const recipients: Who[] = audience === "customer" ? [{ id: event.clientId, accountType: "customer" }] : staffWith("shipments:read:all");
  const filled = copy.map((text) => fill(text, { trackingId: event.trackingId })) as unknown as Copy;
  for (const recipient of recipients) {
    push(recipient, "SHIPMENT_UPDATE", { trackingId: event.trackingId, status: event.status }, filled, { at: event.occurredAt, read });
  }
}

/* ---------------------------------------------------------------------------
 * Other actions (backend ACTION_NOTIFICATION)
 * ------------------------------------------------------------------------ */

type Branch = { id: string; name: string };

/** One action, with what the mock knows when it happens (the backend reads some of it when its job runs). */
export type ActionNotice =
  | { type: "BRANCH_CREATED" | "BRANCH_UPDATED" | "BRANCH_DEACTIVATED"; organization: Branch }
  | { type: "BRANCH_STAFF_ADDED" | "BRANCH_STAFF_REMOVED"; organization: Branch; staffId: string }
  | { type: "STAFF_ACCOUNT_CREATED" | "STAFF_ACCOUNT_DEACTIVATED"; staff: InternalUser }
  | { type: "STAFF_ACCOUNT_UPDATED"; staff: InternalUser; changed: StaffChange[] }
  | {
      type: "CONTACT_REQUEST_RECEIVED" | "CONTACT_REQUEST_ACCEPTED";
      contactId: string;
      requester: InternalUser;
      addressee: InternalUser;
    }
  | { type: "SUPPORT_CONVERSATION_STARTED"; conversationId: string; customerName: string }
  | { type: "SHIPMENT_FILE_ADDED"; trackingId: string; clientId: string; kind: AttachmentKind; fileName: string }
  | { type: "PASSWORD_CHANGED"; account: Who }
  | { type: "API_KEY_CREATED" | "API_KEY_REVOKED"; apiKey: ApiKeyPayload };

type ActionType = ActionNotice["type"];

/** The backend's English copy, by audience (backend/src/i18n/en/notifications.json). */
const ACTION_COPY = {
  BRANCH_CREATED: { admins: ["New branch", "{name} was added as a branch."] },
  BRANCH_UPDATED: {
    staff: ["Your branch was updated", "{name}'s details were updated."],
    admins: ["Branch updated", "{name} was updated."],
  },
  BRANCH_DEACTIVATED: {
    staff: ["Your branch was deactivated", "{name} is no longer active."],
    admins: ["Branch deactivated", "{name} was deactivated."],
  },
  BRANCH_STAFF_ADDED: { self: ["Added to a branch", "You're now part of {name}."] },
  BRANCH_STAFF_REMOVED: { self: ["Removed from a branch", "You're no longer part of {name}."] },
  STAFF_ACCOUNT_CREATED: { admins: ["New staff account", "{name} now has a staff account."] },
  STAFF_ACCOUNT_UPDATED: {
    self: ["Your account was updated", "An admin changed your account. Check your role and branch."],
    admins: ["Staff account updated", "{name}'s account was updated."],
  },
  STAFF_ACCOUNT_DEACTIVATED: { admins: ["Staff account deactivated", "{name}'s account was deactivated."] },
  CONTACT_REQUEST_RECEIVED: { self: ["New contact request", "{name} wants to add you as a contact."] },
  CONTACT_REQUEST_ACCEPTED: { self: ["Contact request accepted", "{name} accepted your contact request."] },
  SUPPORT_CONVERSATION_STARTED: { staff: ["New support conversation", "{customerName} started a support conversation."] },
  SHIPMENT_FILE_ADDED: {
    package_photo: ["New package photo", "A photo of your package was added to {trackingId}."],
    proof_of_delivery: ["Proof of delivery", "The proof of delivery for {trackingId} is ready."],
    other: ["New document", "{fileName} was added to {trackingId}."],
  },
  PASSWORD_CHANGED: {
    self: ["Password changed", "Your password was changed. If this wasn't you, reset it now and contact support."],
  },
  API_KEY_CREATED: {
    admins: ["New API key", "{name} was created for {branch}. Partners can use it with the public API."],
  },
  API_KEY_REVOKED: { admins: ["API key revoked", "{name} for {branch} was revoked. It no longer works."] },
} as const satisfies Record<ActionType, Record<string, Copy>>;

type Audience = { copy: Copy; recipients: Who[] };
type Resolution = { payload: NotificationPayloads[ActionType]; args: Record<string, string>; audiences: Audience[] };

const staffIds = (...ids: string[]): Who[] => ids.map((id) => ({ id, accountType: "staff" }));
const admins = () => staffWith("organizations:manage");

/** Who hears about each action, and what they're told: the backend's RESOLVERS. */
function resolve(notice: ActionNotice): Resolution {
  switch (notice.type) {
    case "BRANCH_CREATED":
      return {
        payload: { organizationId: notice.organization.id, name: notice.organization.name },
        args: { name: notice.organization.name },
        audiences: [{ copy: ACTION_COPY.BRANCH_CREATED.admins, recipients: admins() }],
      };
    case "BRANCH_UPDATED":
    case "BRANCH_DEACTIVATED": {
      const members = internalUsers.filter((user) => user.organizationId === notice.organization.id).map((user) => user.id);
      return {
        payload: { organizationId: notice.organization.id, name: notice.organization.name },
        args: { name: notice.organization.name },
        audiences: [
          { copy: ACTION_COPY[notice.type].staff, recipients: staffIds(...members) },
          { copy: ACTION_COPY[notice.type].admins, recipients: admins() },
        ],
      };
    }
    case "BRANCH_STAFF_ADDED":
    case "BRANCH_STAFF_REMOVED":
      return {
        payload: { organizationId: notice.organization.id, name: notice.organization.name },
        args: { name: notice.organization.name },
        audiences: [{ copy: ACTION_COPY[notice.type].self, recipients: staffIds(notice.staffId) }],
      };
    case "STAFF_ACCOUNT_CREATED":
    case "STAFF_ACCOUNT_DEACTIVATED":
      return {
        payload: { internalUserId: notice.staff.id, name: notice.staff.name },
        args: { name: notice.staff.name },
        audiences: [{ copy: ACTION_COPY[notice.type].admins, recipients: admins() }],
      };
    case "STAFF_ACCOUNT_UPDATED": {
      const { staff } = notice;
      const branch = ORGANIZATIONS.find((org) => org.id === staff.organizationId);
      return {
        payload: {
          internalUserId: staff.id,
          name: staff.name,
          changed: notice.changed,
          roleName: staff.roleName,
          organizationId: staff.organizationId,
          organizationName: branch?.name ?? null,
        },
        args: { name: staff.name },
        audiences: [
          { copy: ACTION_COPY.STAFF_ACCOUNT_UPDATED.self, recipients: staffIds(staff.id) },
          { copy: ACTION_COPY.STAFF_ACCOUNT_UPDATED.admins, recipients: admins() },
        ],
      };
    }
    case "CONTACT_REQUEST_RECEIVED":
    case "CONTACT_REQUEST_ACCEPTED": {
      // Received: the addressee hears who asked. Accepted: the requester hears who accepted.
      const [other, told] =
        notice.type === "CONTACT_REQUEST_RECEIVED" ? [notice.requester, notice.addressee] : [notice.addressee, notice.requester];
      return {
        payload: { contactId: notice.contactId, internalUserId: other.id, name: other.name },
        args: { name: other.name },
        audiences: [{ copy: ACTION_COPY[notice.type].self, recipients: staffIds(told.id) }],
      };
    }
    case "SUPPORT_CONVERSATION_STARTED":
      return {
        payload: { conversationId: notice.conversationId, customerName: notice.customerName },
        args: { customerName: notice.customerName },
        audiences: [{ copy: ACTION_COPY.SUPPORT_CONVERSATION_STARTED.staff, recipients: staffWith("chat:support:access") }],
      };
    case "SHIPMENT_FILE_ADDED":
      return {
        payload: { trackingId: notice.trackingId, kind: notice.kind, fileName: notice.fileName },
        args: { trackingId: notice.trackingId, fileName: notice.fileName },
        audiences: [
          {
            copy: ACTION_COPY.SHIPMENT_FILE_ADDED[notice.kind],
            recipients: [{ id: notice.clientId, accountType: "customer" }],
          },
        ],
      };
    case "PASSWORD_CHANGED":
      return { payload: {}, args: {}, audiences: [{ copy: ACTION_COPY.PASSWORD_CHANGED.self, recipients: [notice.account] }] };
    case "API_KEY_CREATED":
    case "API_KEY_REVOKED":
      return {
        payload: notice.apiKey,
        args: { name: notice.apiKey.name, branch: notice.apiKey.branchName },
        audiences: [{ copy: ACTION_COPY[notice.type].admins, recipients: admins() }],
      };
  }
}

const keyOf = (who: Who) => `${who.accountType}:${who.id}`;
const isActive = (who: Who) => who.accountType === "customer" || internalUsers.some((user) => user.id === who.id && user.isActive);

/**
 * What the backend's ACTION_NOTIFICATION job does: each person once (in their
 * first audience), never the actor (except a password notice, a security
 * warning), and staff only while their account is active.
 */
export function notifyAction(notice: ActionNotice, actor: Who | null, when: When = {}) {
  const { payload, args, audiences } = resolve(notice);
  const seen = new Set<string>();
  for (const { copy, recipients } of audiences) {
    for (const recipient of recipients) {
      const key = keyOf(recipient);
      if (seen.has(key)) continue;
      seen.add(key);
      const isActor = actor !== null && key === keyOf(actor);
      if ((isActor && notice.type !== "PASSWORD_CHANGED") || !isActive(recipient)) continue;
      const filled = copy.map((text) => fill(text, args)) as unknown as Copy;
      push(recipient, notice.type, payload, filled, when);
    }
  }
}

/* ---------------------------------------------------------------------------
 * Seeds for the actions no other mock seeds: a few for the mock staff, over
 * the last days. Contacts, support conversations and shipment files seed
 * their own (contacts.ts, chat.ts, shipments.ts). Older than a day: read.
 * ------------------------------------------------------------------------ */
{
  const HOUR = 3_600_000;
  const ago = (ms: number): When => ({ at: new Date(Date.now() - ms).toISOString(), read: ms > 24 * HOUR });
  const staff = (name: string) => internalUsers.find((user) => user.name === name)!;
  const branch = (name: string) => ORGANIZATIONS.find((org) => org.name === name)!;
  const asStaff = (user: InternalUser): Who => ({ id: user.id, accountType: "staff" });
  const nadia = asStaff(staff("Nadia Haddad"));
  const youssef = asStaff(staff("Youssef Benali"));

  notifyAction({ type: "PASSWORD_CHANGED", account: nadia }, nadia, ago(4 * 24 * HOUR));
  notifyAction({ type: "STAFF_ACCOUNT_UPDATED", staff: staff("Anas Berrada"), changed: ["branch"] }, nadia, ago(3 * 24 * HOUR));
  notifyAction({ type: "STAFF_ACCOUNT_CREATED", staff: staff("Tarek Jaber") }, youssef, ago(2 * 24 * HOUR));
  notifyAction({ type: "BRANCH_UPDATED", organization: branch("Lyon Part-Dieu") }, nadia, ago(26 * HOUR));
  notifyAction({ type: "BRANCH_STAFF_ADDED", organization: branch("Beirut Central"), staffId: staff("Sami Hajj").id }, nadia, ago(5 * HOUR));
}
