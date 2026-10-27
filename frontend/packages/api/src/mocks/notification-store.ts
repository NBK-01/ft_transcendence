import { roleCan, type Permission } from "../permissions";
import type {
  AccountType,
  ApiKeyPayload,
  AppNotification,
  AttachmentKind,
  InternalUser,
  NotificationPayloads,
  NotificationType,
  ShipmentActorType,
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

/** One row; `ownAction` when the recipient is the one who acted. */
function push(
  recipient: Who,
  type: NotificationType,
  payload: unknown,
  [title, message]: Copy,
  { at, read = false }: When,
  ownAction = false,
) {
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
    ownAction,
    createdAt,
    sentAt: createdAt,
    readAt: read ? new Date(Date.parse(createdAt) + 3_600_000).toISOString() : null,
    dismissedAt: null,
  } as Row);
}

/** Whether the account may be notified: staff while active. No mock customer is deactivated. */
const isActive = (who: Who) => who.accountType === "customer" || internalUsers.some((user) => user.id === who.id && user.isActive);

/** Active staff whose role has `permission`, as their role is now (the backend reads the role → permission table). */
const staffWith = (permission: Permission): Who[] =>
  internalUsers
    .filter((user) => user.isActive && roleCan(user.roleName, permission))
    .map((user) => ({ id: user.id, accountType: "staff" }));

/* ---------------------------------------------------------------------------
 * Shipment events (backend SHIPMENT_EVENT_NOTIFICATION)
 * ------------------------------------------------------------------------ */

/** An event from before its actor was recorded: the side that didn't cause it, by status (backend AUDIENCE_BY_STATUS). */
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

/** The side that didn't act; a partner or the carrier is neither, so both hear (backend audiencesFor). */
function audiencesFor(actorType: ShipmentActorType | null, status: ShipmentState): AccountType[] {
  switch (actorType) {
    case "customer":
      return ["staff"];
    case "staff":
      return ["customer"];
    case "partner":
    case "carrier":
      return ["customer", "staff"];
    default: {
      const audience = AUDIENCE_BY_STATUS[status];
      return audience ? [audience] : [];
    }
  }
}

/** A step, or "created" for a partner's new shipment. */
type ShipmentStep = ShipmentState | "created";

/** The backend's English copy (backend/src/i18n/en/notifications.json). */
const SHIPMENT_COPY: Record<AccountType, Partial<Record<ShipmentStep, Copy>>> = {
  customer: {
    pending_client_decision: [
      "Your offer is ready",
      "We found a supplier for {trackingId}. Review the offer to accept or reject it.",
    ],
    confirmed: ["Payment confirmed", "Your payment for {trackingId} is confirmed. We'll let you know when it ships."],
    created: ["New shipment", "A shipment, {trackingId}, was created for you. We'll let you know when it ships."],
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
    created: ["New partner shipment", "A partner created {trackingId} through the API."],
    in_transit: ["In transit", "{trackingId} is on its way."],
    out_for_delivery: ["Out for delivery", "{trackingId} is out for delivery."],
    delivered: ["Delivered", "{trackingId} has been delivered."],
    cancelled: ["Shipment cancelled", "{trackingId} has been cancelled."],
  },
};

/** What the person who moved it is told (the backend's SHIPMENT_UPDATE.actor copy), by actorStep. */
const SHIPMENT_ACTOR_COPY: Record<string, Copy> = {
  requested: ["Request sent", "You requested {trackingId}. We're finding a supplier."],
  rejected: ["Offer rejected", "You rejected the offer for {trackingId}. We're finding another supplier."],
  pending_payment: ["Offer accepted", "You accepted the offer for {trackingId}. Pay to confirm it."],
  pending_payment_confirmation: ["Payment sent", "You paid for {trackingId}. We'll confirm the payment shortly."],
  pending_client_decision: ["Offer sent", "You sent an offer for {trackingId}. The customer can accept or reject it now."],
  confirmed: ["Payment confirmed", "You confirmed the payment for {trackingId}. Tracking can start."],
  in_transit: ["Tracking updated", "You marked {trackingId} as in transit."],
  out_for_delivery: ["Tracking updated", "You marked {trackingId} as out for delivery."],
  delivered: ["Tracking updated", "You marked {trackingId} as delivered."],
  cancelled: ["Shipment cancelled", "You cancelled {trackingId}."],
};

export type NotifiedShipmentEvent = {
  trackingId: string;
  /** The shipment's customer. */
  clientId: string;
  status: ShipmentState;
  occurredAt: string;
  /** Who moved it (a customer's, staff member's or API key's id; none for the carrier); null for an event from before it was recorded. */
  actor: { type: ShipmentActorType; id: string | null } | null;
  /** The shipment's first event: a new request, or a partner's new shipment (at `confirmed`). */
  isFirstEvent?: boolean;
};

/** What the backend's job does for a committed shipment event: one row per recipient, already delivered (SENT). */
export function notifyShipmentEvent(event: NotifiedShipmentEvent, { read = false }: { read?: boolean } = {}) {
  const { actor } = event;
  const isNew = event.isFirstEvent === true && event.status === "confirmed";
  const payload = {
    trackingId: event.trackingId,
    status: event.status,
    ...(isNew && { isNew: true as const }),
    ...(actor && { actorType: actor.type }),
  };
  const when = { at: event.occurredAt, read };
  const filled = (copy: Copy) => copy.map((text) => fill(text, { trackingId: event.trackingId })) as unknown as Copy;

  // The person who moved it gets a record of it; a partner or the carrier isn't one.
  if (actor?.id && (actor.type === "customer" || actor.type === "staff")) {
    const step = event.status === "pending_sourcing" ? (event.isFirstEvent ? "requested" : "rejected") : event.status;
    const copy = SHIPMENT_ACTOR_COPY[step];
    if (copy) push({ id: actor.id, accountType: actor.type }, "SHIPMENT_UPDATE", payload, filled(copy), when, true);
  }
  for (const audience of audiencesFor(actor?.type ?? null, event.status)) {
    const copy = SHIPMENT_COPY[audience][isNew ? "created" : event.status];
    if (!copy) continue;
    const recipients: Who[] =
      audience === "customer" ? [{ id: event.clientId, accountType: "customer" }] : staffWith("shipments:read:all");
    for (const recipient of recipients.filter(isActive)) {
      push(recipient, "SHIPMENT_UPDATE", payload, filled(copy), when);
    }
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
  BRANCH_CREATED: {
    admins: ["New branch", "{name} was added as a branch."],
    actor: ["Branch created", "You created the branch {name}."],
  },
  BRANCH_UPDATED: {
    staff: ["Your branch was updated", "{name}'s details were updated."],
    admins: ["Branch updated", "{name} was updated."],
    actor: ["Branch updated", "You updated the branch {name}."],
  },
  BRANCH_DEACTIVATED: {
    staff: ["Your branch was deactivated", "{name} is no longer active."],
    admins: ["Branch deactivated", "{name} was deactivated."],
    actor: ["Branch deactivated", "You deactivated the branch {name}."],
  },
  BRANCH_STAFF_ADDED: {
    self: ["Added to a branch", "You're now part of {name}."],
    actor: ["Member added", "You added {staffName} to {name}."],
  },
  BRANCH_STAFF_REMOVED: {
    self: ["Removed from a branch", "You're no longer part of {name}."],
    actor: ["Member removed", "You removed {staffName} from {name}."],
  },
  STAFF_ACCOUNT_CREATED: {
    admins: ["New staff account", "{name} now has a staff account."],
    actor: ["Staff account created", "You created {name}'s account. They can sign in now."],
  },
  STAFF_ACCOUNT_UPDATED: {
    self: ["Your account was updated", "An admin changed your account. Check your role and branch."],
    admins: ["Staff account updated", "{name}'s account was updated."],
    actor: ["Staff account updated", "You updated {name}'s account."],
  },
  STAFF_ACCOUNT_DEACTIVATED: {
    admins: ["Staff account deactivated", "{name}'s account was deactivated."],
    actor: ["Staff account deactivated", "You deactivated {name}'s account."],
  },
  CONTACT_REQUEST_RECEIVED: {
    self: ["New contact request", "{name} wants to add you as a contact."],
    actor: ["Contact request sent", "You asked {name} to be a contact."],
  },
  CONTACT_REQUEST_ACCEPTED: {
    self: ["Contact request accepted", "{name} accepted your contact request."],
    actor: ["Contact request accepted", "You and {name} are contacts now."],
  },
  SUPPORT_CONVERSATION_STARTED: {
    staff: ["New support conversation", "{customerName} started a support conversation."],
    actor: ["Support conversation started", "Our support team will answer you in Messages."],
  },
  SHIPMENT_FILE_ADDED: {
    package_photo: ["New package photo", "A photo of your package was added to {trackingId}."],
    proof_of_delivery: ["Proof of delivery", "The proof of delivery for {trackingId} is ready."],
    other: ["New document", "{fileName} was added to {trackingId}."],
    actor: ["File added", "You added {fileName} to {trackingId}."],
  },
  PASSWORD_CHANGED: {
    self: ["Password changed", "Your password was changed. If this wasn't you, reset it now and contact support."],
  },
  API_KEY_CREATED: {
    admins: ["New API key", "{name} was created for {branch}. Partners can use it with the public API."],
    actor: ["API key created", "You created {name} for {branch}. Its full key was shown once."],
  },
  API_KEY_REVOKED: {
    admins: ["API key revoked", "{name} for {branch} was revoked. It no longer works."],
    actor: ["API key revoked", "You revoked {name} for {branch}. It no longer works."],
  },
} as const satisfies Record<ActionType, Record<string, Copy>>;

type Audience = { copy: Copy; recipients: Who[] };
type About = { payload: NotificationPayloads[ActionType]; args: Record<string, string> };
/** `forActor`: what the person who acted is told instead, when "the other person" is someone else for them. */
type Resolution = About & { audiences: Audience[]; forActor?: About };

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
    case "BRANCH_STAFF_REMOVED": {
      const staffName = internalUsers.find((user) => user.id === notice.staffId)?.name ?? "";
      return {
        payload: { organizationId: notice.organization.id, name: notice.organization.name, staffName },
        args: { name: notice.organization.name, staffName },
        audiences: [{ copy: ACTION_COPY[notice.type].self, recipients: staffIds(notice.staffId) }],
      };
    }
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
      // Whoever acted is told about the other one.
      const [other, told] =
        notice.type === "CONTACT_REQUEST_RECEIVED" ? [notice.requester, notice.addressee] : [notice.addressee, notice.requester];
      const about = (person: InternalUser): About => ({
        payload: { contactId: notice.contactId, internalUserId: person.id, name: person.name },
        args: { name: person.name },
      });
      return {
        ...about(other),
        audiences: [{ copy: ACTION_COPY[notice.type].self, recipients: staffIds(told.id) }],
        forActor: about(told),
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

/**
 * What the backend's ACTION_NOTIFICATION job does: the person who acted
 * first, with a record of their own action (but for a password notice, which
 * warns its owner the same way whoever changed it), then each other person
 * once (in their first audience); only while their account is active.
 */
export function notifyAction(notice: ActionNotice, actor: Who | null, when: When = {}) {
  const resolution = resolve(notice);
  const seen = new Set<string>();
  const notify = (recipient: Who, copy: Copy, { payload, args }: About, ownAction: boolean) => {
    const key = keyOf(recipient);
    if (seen.has(key)) return;
    seen.add(key);
    if (!isActive(recipient)) return;
    const filled = copy.map((text) => fill(text, args)) as unknown as Copy;
    push(recipient, notice.type, payload, filled, when, ownAction);
  };
  if (actor && notice.type !== "PASSWORD_CHANGED") {
    notify(actor, ACTION_COPY[notice.type].actor, resolution.forActor ?? resolution, true);
  }
  for (const { copy, recipients } of resolution.audiences) {
    for (const recipient of recipients) notify(recipient, copy, resolution, false);
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
