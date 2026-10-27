import { Bell, FileText, Headset, KeyRound, LogOut, MessageSquare, Package, PartyPopper, UserCog, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { AppNotification, NotificationType } from "@trans/api";

/**
 * How the client shows each notification type: an icon, a title and a line of
 * text in the reader's language (from `type` + `payload`), and the page it
 * opens. A customer only ever gets the types below: shipment updates and
 * files, the welcome, their profile, password and sign-out notices, support's
 * messages, and a record of opening a support conversation (ownAction). The
 * rest are staff-only, so they're left out here and fall back to the
 * backend's English title and message, same as admin does for a type it
 * doesn't know.
 */

/** `t` from useTranslation("app"), narrowed to what the wording needs. */
type Translate = (key: string, values?: Record<string, string>) => string;

export type NotificationView = {
  icon: LucideIcon;
  title: string;
  message: string;
  /** The backend's English title and message are shown as they are. */
  fallback: boolean;
  /** The page it's about; null when it doesn't link anywhere. */
  href: string | null;
};

type CustomerType =
  | "SHIPMENT_UPDATE"
  | "SHIPMENT_FILE_ADDED"
  | "PASSWORD_CHANGED"
  | "SUPPORT_CONVERSATION_STARTED"
  | "CUSTOMER_REGISTERED"
  | "PROFILE_UPDATED"
  | "SESSIONS_REVOKED"
  | "MESSAGE_RECEIVED";
type Of<T extends NotificationType> = Extract<AppNotification, { type: T }>;
type Wording = { title: string; message: string };

type Kind<T extends NotificationType> = {
  icon: LucideIcon;
  wording: (notification: Of<T>, t: Translate) => Wording;
  /** The reader's record of their own action ("You…"), when it reads differently. */
  own?: (notification: Of<T>, t: Translate) => Wording;
  href: (notification: Of<T>) => string | null;
};

const shipmentPath = (trackingId: string) => `/app/shipments/${encodeURIComponent(trackingId)}`;

/** The shipment steps this app has specific wording for; anything else (staff-only steps) gets a general line. */
const SHIPMENT_STEPS = new Set(["pending_client_decision", "confirmed", "in_transit", "out_for_delivery", "delivered", "cancelled"]);
/** The steps the customer takes, worded for their own record of them. */
const OWN_STEPS = new Set(["pending_sourcing", "pending_payment", "pending_payment_confirmation"]);

const shipmentTitle = ({ payload }: Of<"SHIPMENT_UPDATE">, t: Translate) =>
  t("notifications.types.shipment.title", { trackingId: payload.trackingId, status: t(`common:status.${payload.status}`) });

const KINDS: { [T in CustomerType]: Kind<T> } = {
  SHIPMENT_UPDATE: {
    icon: Package,
    wording: (notification, t) => ({
      title: shipmentTitle(notification, t),
      message: t(
        `notifications.types.shipment.${notification.payload.isNew ? "created" : SHIPMENT_STEPS.has(notification.payload.status) ? notification.payload.status : "other"}`,
      ),
    }),
    own: (notification, t) => ({
      title: shipmentTitle(notification, t),
      message: t(`notifications.own.shipment.${OWN_STEPS.has(notification.payload.status) ? notification.payload.status : "other"}`),
    }),
    href: ({ payload }) => shipmentPath(payload.trackingId),
  },
  SHIPMENT_FILE_ADDED: {
    icon: FileText,
    wording: ({ payload }, t) => ({
      title: t(`notifications.types.shipmentFile.${payload.kind}.title`),
      message: t(`notifications.types.shipmentFile.${payload.kind}.message`, {
        trackingId: payload.trackingId,
        fileName: payload.fileName,
      }),
    }),
    href: ({ payload }) => shipmentPath(payload.trackingId),
  },
  PASSWORD_CHANGED: {
    icon: KeyRound,
    wording: (_, t) => ({
      title: t("notifications.types.passwordChanged.title"),
      message: t("notifications.types.passwordChanged.message"),
    }),
    href: () => "/app/profile",
  },
  // Only ever the customer's own record: staff hear about it, not them.
  SUPPORT_CONVERSATION_STARTED: {
    icon: Headset,
    wording: (_, t) => ({
      title: t("notifications.types.supportStarted.title"),
      message: t("notifications.types.supportStarted.message"),
    }),
    href: () => "/app/messages",
  },
  CUSTOMER_REGISTERED: {
    icon: PartyPopper,
    wording: (_, t) => ({
      title: t("notifications.types.welcome.title"),
      message: t("notifications.types.welcome.message"),
    }),
    href: () => "/app/shipments/new",
  },
  // Only the customer changes their profile, so it's always "you".
  PROFILE_UPDATED: {
    icon: UserCog,
    wording: ({ payload }, t) => ({
      title: t("notifications.types.profileUpdated.title"),
      message: t(`notifications.types.profileUpdated.${payload.change}`),
    }),
    href: () => "/app/profile",
  },
  SESSIONS_REVOKED: {
    icon: LogOut,
    wording: (_, t) => ({
      title: t("notifications.types.sessionsRevoked.title"),
      message: t("notifications.types.sessionsRevoked.message"),
    }),
    href: () => "/app/profile",
  },
  MESSAGE_RECEIVED: {
    icon: MessageSquare,
    wording: ({ payload }, t) => ({
      title: t("notifications.types.message.title"),
      message: t("notifications.types.message.message", { name: payload.senderName }),
    }),
    href: () => "/app/messages",
  },
};

export function describeNotification(notification: AppNotification, t: Translate): NotificationView {
  // Looked up by its own type, so the payload matches; TypeScript can't follow that through the union.
  const kind = (KINDS as Partial<Record<NotificationType, Kind<NotificationType>>>)[notification.type];
  const wording = (notification.ownAction && kind?.own ? kind.own(notification, t) : kind?.wording(notification, t)) ?? null;
  return {
    icon: kind?.icon ?? Bell,
    title: wording?.title ?? notification.title,
    message: wording?.message ?? notification.message,
    fallback: wording === null,
    href: kind?.href(notification) ?? null,
  };
}

/** describeNotification for the signed-in customer, in the current language. */
export function useDescribeNotification() {
  const { t } = useTranslation(["app", "common"]);
  return (notification: AppNotification): NotificationView => describeNotification(notification, t);
}
