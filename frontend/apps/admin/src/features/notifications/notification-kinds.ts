import {
  Ban,
  Bell,
  Building2,
  Contact,
  FileText,
  Headset,
  KeyRound,
  LogOut,
  MessageSquare,
  Package,
  UserCheck,
  UserCog,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  useStaffAccess,
  type ApiKeyPayload,
  useStaffSession,
  type AppNotification,
  type NotificationType,
  type Permission,
  type ShipmentState,
  type StaffChange,
} from "@trans/api";

import { useBranchFilter } from "../branches/use-branch-filter";

/**
 * How the admin shows each notification type: an icon, a title and a line of
 * text in the reader's language (from `type` + `payload`), and the page it
 * opens. Typed per type, so a new NotificationType doesn't compile until it's
 * handled here. The backend's `title` and `message` are English only, so
 * they're the fallback: for a type staff never get, or one this app doesn't know yet.
 */

/** Who's reading: the wording ("your account") and the links depend on it. */
export type Reader = {
  id: string | undefined;
  isAdmin: boolean;
  can: (permission: Permission) => boolean;
};

/** `t` from useTranslation("app"), narrowed to what the wording needs. */
type Translate = (key: string, values?: Record<string, string>) => string;

export type NotificationView = {
  icon: LucideIcon;
  title: string;
  message: string;
  /** The backend's English title and message are shown as they are. */
  fallback: boolean;
  /** The page it's about, without the branch filter; null when the reader has none. */
  href: string | null;
};

type Of<T extends NotificationType> = Extract<AppNotification, { type: T }>;
type Wording = { title: string; message: string };

type Kind<T extends NotificationType> = {
  icon: LucideIcon;
  /** null: show the backend's English title and message. */
  wording: (notification: Of<T>, t: Translate, reader: Reader) => Wording | null;
  /** The reader's record of their own action ("You…"); without it, the backend's English. */
  own?: (notification: Of<T>, t: Translate) => Wording;
  href: (notification: Of<T>, reader: Reader) => string | null;
};

/** The customer's steps, worded by what they did; anything else staff hear about came from a partner or the carrier. */
const CUSTOMER_STEPS: ReadonlySet<ShipmentState> = new Set(["pending_sourcing", "pending_payment", "pending_payment_confirmation"]);

/** Which line explains a shipment step: what the customer did, or who moved it from outside. */
function shipmentLine({ status, isNew, actorType }: Of<"SHIPMENT_UPDATE">["payload"]): string {
  if (isNew) return "partnerCreated";
  if (actorType === "partner" || actorType === "carrier") return actorType;
  return CUSTOMER_STEPS.has(status) ? status : "other";
}

const shipmentPath = (trackingId: string, reader: Reader) =>
  reader.can("shipments:read:all") ? `/shipments/${encodeURIComponent(trackingId)}` : null;
const branchPath = (organizationId: string) => `/branches/${encodeURIComponent(organizationId)}`;
const usersPath = (reader: Reader) => (reader.isAdmin ? "/users" : null);

/** A title and a line about one named thing: a branch, a staff account, a contact. */
const named =
  (key: string) =>
  ({ payload }: { payload: { name: string } }, t: Translate): Wording => ({
    title: t(`notifications.types.${key}.title`, { name: payload.name }),
    message: t(`notifications.types.${key}.message`, { name: payload.name }),
  });

/** A record of the reader's own action, from notifications.own.<key>, with the payload's names. */
const own =
  (key: string) =>
  ({ payload }: { payload: object }, t: Translate): Wording => {
    const values: Record<string, string> = { staffName: t("notifications.own.someone") };
    for (const [name, value] of Object.entries(payload)) if (typeof value === "string") values[name] = value;
    return { title: t(`notifications.own.${key}.title`, values), message: t(`notifications.own.${key}.message`, values) };
  };

/** What an account update changed, one sentence each, about "you" or "them". */
function staffChanges({ payload }: Of<"STAFF_ACCOUNT_UPDATED">, t: Translate, self: boolean) {
  const base = `notifications.types.staffUpdated.${self ? "self" : "others"}`;
  const sentences: Record<StaffChange, () => string> = {
    role: () =>
      payload.roleName
        ? t(`${base}.role`, { role: t(`users.roles.${payload.roleName}`, { defaultValue: payload.roleName }) })
        : t(`${base}.noRole`),
    branch: () =>
      payload.organizationName ? t(`${base}.branch`, { branch: payload.organizationName }) : t(`${base}.noBranch`),
    name: () => t(`${base}.name`),
    reactivated: () => t(`${base}.reactivated`),
  };
  // A change this app doesn't know yet is left out; with none left, a general line.
  const known = payload.changed.flatMap((change) => sentences[change]?.() ?? []);
  return {
    title: t(`${base}.title`, { name: payload.name }),
    message: known.length > 0 ? known.join(" ") : t(`${base}.other`),
  };
}

const messagesPath = (conversationId: string) => `/messages/${encodeURIComponent(conversationId)}`;

/** The reader's own profile: only they change it, so it's always "you". */
const profileWording = ({ payload }: Of<"PROFILE_UPDATED">, t: Translate): Wording => ({
  title: t("notifications.types.profileUpdated.title"),
  message: t(`notifications.types.profileUpdated.${payload.change}`),
});

/** A contact declined, withdrawn, removed or blocked: only ever the reader's own record of it. */
type ContactRecordType = "CONTACT_REQUEST_DECLINED" | "CONTACT_REQUEST_CANCELLED" | "CONTACT_REMOVED" | "CONTACT_BLOCKED";
const contactRecord = <T extends ContactRecordType>(icon: LucideIcon, key: string): Kind<T> => ({
  icon,
  wording: () => null,
  own: own(key),
  href: () => "/contacts",
});

/** Partner API keys: admins only, like the page they link to. */
const apiKeysPath = (reader: Reader) => (reader.isAdmin ? "/api-keys" : null);

/** A key by its name and branch, as they were when it happened. */
const apiKeyWording =
  (key: "apiKeyCreated" | "apiKeyRevoked") =>
  ({ payload }: { payload: ApiKeyPayload }, t: Translate): Wording => ({
    title: t(`notifications.types.${key}.title`, { name: payload.name }),
    message: t(`notifications.types.${key}.message`, { branch: payload.branchName }),
  });

const KINDS: { [T in NotificationType]: Kind<T> } = {
  SHIPMENT_UPDATE: {
    icon: Package,
    wording: ({ payload }, t) => ({
      title: t("notifications.types.shipment.title", {
        trackingId: payload.trackingId,
        status: t(`common:status.${payload.status}`),
      }),
      message: t(`notifications.types.shipment.${shipmentLine(payload)}`),
    }),
    own: ({ payload }, t) => ({
      title: t("notifications.types.shipment.title", {
        trackingId: payload.trackingId,
        status: t(`common:status.${payload.status}`),
      }),
      message: t("notifications.own.shipment"),
    }),
    href: ({ payload }, reader) => shipmentPath(payload.trackingId, reader),
  },
  BRANCH_CREATED: {
    icon: Building2,
    wording: named("branchCreated"),
    own: own("branchCreated"),
    href: ({ payload }) => branchPath(payload.organizationId),
  },
  BRANCH_UPDATED: {
    icon: Building2,
    wording: named("branchUpdated"),
    own: own("branchUpdated"),
    href: ({ payload }) => branchPath(payload.organizationId),
  },
  BRANCH_DEACTIVATED: {
    icon: Building2,
    wording: named("branchDeactivated"),
    own: own("branchDeactivated"),
    href: ({ payload }) => branchPath(payload.organizationId),
  },
  BRANCH_STAFF_ADDED: {
    icon: Building2,
    wording: named("branchStaffAdded"),
    own: own("branchStaffAdded"),
    href: ({ payload }) => branchPath(payload.organizationId),
  },
  BRANCH_STAFF_REMOVED: {
    icon: Building2,
    wording: named("branchStaffRemoved"),
    own: own("branchStaffRemoved"),
    href: ({ payload }) => branchPath(payload.organizationId),
  },
  STAFF_ACCOUNT_CREATED: {
    icon: UserPlus,
    wording: named("staffCreated"),
    own: own("staffCreated"),
    href: (_, reader) => usersPath(reader),
  },
  STAFF_ACCOUNT_UPDATED: {
    icon: UserCog,
    // To the account's owner ("your role is now…") and to the other admins ("their role…").
    wording: (notification, t, reader) => staffChanges(notification, t, notification.payload.internalUserId === reader.id),
    own: own("staffUpdated"),
    href: ({ payload }, reader) => (payload.internalUserId === reader.id ? "/profile" : usersPath(reader)),
  },
  STAFF_ACCOUNT_DEACTIVATED: {
    icon: UserX,
    wording: named("staffDeactivated"),
    own: own("staffDeactivated"),
    href: (_, reader) => usersPath(reader),
  },
  CONTACT_REQUEST_RECEIVED: { icon: Contact, wording: named("contactReceived"), own: own("contactSent"), href: () => "/contacts" },
  CONTACT_REQUEST_ACCEPTED: {
    icon: UserCheck,
    wording: named("contactAccepted"),
    own: own("contactAccepted"),
    href: () => "/contacts",
  },
  SUPPORT_CONVERSATION_STARTED: {
    icon: Headset,
    wording: ({ payload }, t) => ({
      title: t("notifications.types.supportStarted.title"),
      message: t("notifications.types.supportStarted.message", { name: payload.customerName }),
    }),
    href: ({ payload }) => messagesPath(payload.conversationId),
  },
  // Only customers hear about these (a file on their shipment); staff only get the record of adding one.
  SHIPMENT_FILE_ADDED: {
    icon: FileText,
    wording: () => null,
    own: own("fileAdded"),
    href: ({ payload }, reader) => shipmentPath(payload.trackingId, reader),
  },
  PASSWORD_CHANGED: {
    icon: KeyRound,
    wording: (_, t) => ({
      title: t("notifications.types.passwordChanged.title"),
      message: t("notifications.types.passwordChanged.message"),
    }),
    href: () => "/profile",
  },
  API_KEY_CREATED: {
    icon: KeyRound,
    wording: apiKeyWording("apiKeyCreated"),
    own: own("apiKeyCreated"),
    href: (_, reader) => apiKeysPath(reader),
  },
  API_KEY_REVOKED: {
    icon: KeyRound,
    wording: apiKeyWording("apiKeyRevoked"),
    own: own("apiKeyRevoked"),
    href: (_, reader) => apiKeysPath(reader),
  },
  // Customers have no page in the admin: these link nowhere.
  CUSTOMER_REGISTERED: { icon: UserPlus, wording: named("customerRegistered"), href: () => null },
  CUSTOMER_ACCOUNT_DEACTIVATED: { icon: UserX, wording: named("customerDeactivated"), href: () => null },
  PROFILE_UPDATED: { icon: UserCog, wording: profileWording, own: profileWording, href: () => "/profile" },
  SESSIONS_REVOKED: {
    icon: LogOut,
    wording: (_, t) => ({
      title: t("notifications.types.sessionsRevoked.title"),
      message: t("notifications.types.sessionsRevoked.message"),
    }),
    href: () => "/profile",
  },
  CONTACT_REQUEST_DECLINED: contactRecord(UserX, "contactDeclined"),
  CONTACT_REQUEST_CANCELLED: contactRecord(UserX, "contactCancelled"),
  CONTACT_REMOVED: contactRecord(UserMinus, "contactRemoved"),
  CONTACT_BLOCKED: contactRecord(Ban, "contactBlocked"),
  CONVERSATION_STARTED: {
    icon: MessageSquare,
    wording: named("conversationStarted"),
    own: own("conversationStarted"),
    href: ({ payload }) => messagesPath(payload.conversationId),
  },
  MESSAGE_RECEIVED: {
    icon: MessageSquare,
    wording: ({ payload }, t) => ({
      title: t(`notifications.types.message.${payload.conversationType === "support" ? "supportTitle" : "title"}`),
      message: t(`notifications.types.message.${payload.conversationType}`, { name: payload.senderName }),
    }),
    href: ({ payload }) => messagesPath(payload.conversationId),
  },
};

export function describeNotification(notification: AppNotification, t: Translate, reader: Reader): NotificationView {
  // Looked up by its own type, so the payload matches; TypeScript can't follow that through the union.
  const kind = KINDS[notification.type] as Kind<NotificationType> | undefined;
  const wording = (notification.ownAction ? kind?.own?.(notification, t) : kind?.wording(notification, t, reader)) ?? null;
  return {
    icon: kind?.icon ?? Bell,
    title: wording?.title ?? notification.title,
    message: wording?.message ?? notification.message,
    fallback: wording === null,
    href: kind?.href(notification, reader) ?? null,
  };
}

/** describeNotification for the signed-in staff member, in the current language, with links that keep the branch filter. */
export function useDescribeNotification() {
  const { t } = useTranslation("app");
  const { user } = useStaffSession();
  const { isAdmin, can } = useStaffAccess();
  const { withBranch } = useBranchFilter();
  const reader: Reader = { id: user?.id, isAdmin, can };
  const translate: Translate = (key, values) => t(key, values);
  return (notification: AppNotification): NotificationView => {
    const view = describeNotification(notification, translate, reader);
    return { ...view, href: view.href && withBranch(view.href) };
  };
}
