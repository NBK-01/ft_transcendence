import { http } from "msw/http";

import { NOTIFICATION_NOT_FOUND } from "../notifications";
import { roleCan } from "../permissions";
import type {
  AccountType,
  AppNotification,
  MessageResponse,
  NotificationCount,
  NotificationType,
  ShipmentState,
} from "../types";
import { customerForToken } from "./auth";
import { internalUsers } from "./data";
import { error, ok, paginated } from "./respond";
import { staffForToken } from "./staff-auth";

/**
 * Notifications (backend NotificationsController), for customers and staff
 * alike: a customer token (the client app, always Amina) or an active staff
 * token. Each sees only their own; someone else's id is a 404 (12001), like a
 * dismissed or unknown one. The backend's order: the token (401), the id
 * (400 if it isn't a UUID), then the notification (404).
 *
 * Rows come from shipments.ts, which calls notifyShipmentEvent like the
 * backend's SHIPMENT_EVENT_NOTIFICATION job: for the last week of its seeded
 * timelines (anything older than a day already read), and for every change
 * made through the admin shipment mocks. In-memory, like the rest.
 */

const NOTIFICATION_TYPES: readonly NotificationType[] = ["SHIPMENT_UPDATE"];

type Row = AppNotification & {
  userId: string;
  accountType: AccountType;
  sentAt: string | null;
  dismissedAt: string | null;
};

const rows: Row[] = [];

let ids = 0;
const nextId = () => `00000000-0000-4000-d000-${String(++ids).padStart(12, "0")}`;

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
const COPY: Record<AccountType, Partial<Record<ShipmentState, [title: string, message: string]>>> = {
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

/** Active staff whose role has shipments:read:all (admin and support), as their role is now. */
const shipmentStaff = () => internalUsers.filter((user) => user.isActive && roleCan(user.roleName, "shipments:read:all"));

export type NotifiedShipmentEvent = {
  trackingId: string;
  /** The shipment's customer. */
  clientId: string;
  status: ShipmentState;
  occurredAt: string;
};

/**
 * What the backend's job does for a committed shipment event: one row per
 * recipient, already delivered (SENT). `read` is for seed data that the
 * recipient has opened since.
 */
export function notifyShipmentEvent(event: NotifiedShipmentEvent, { read = false }: { read?: boolean } = {}) {
  const audience = AUDIENCE_BY_STATUS[event.status];
  const copy = audience && COPY[audience][event.status];
  if (!audience || !copy) return;

  const recipients =
    audience === "customer" ? [event.clientId] : shipmentStaff().map((user) => user.id);
  const [title, message] = copy.map((text) => text.replaceAll("{trackingId}", event.trackingId));
  const readAt = read ? new Date(Date.parse(event.occurredAt) + 3_600_000).toISOString() : null;
  for (const userId of recipients) {
    rows.push({
      id: nextId(),
      userId,
      accountType: audience,
      type: "SHIPMENT_UPDATE",
      status: read ? "READ" : "SENT",
      title: title!,
      message: message!,
      payload: { trackingId: event.trackingId, status: event.status },
      createdAt: event.occurredAt,
      sentAt: event.occurredAt,
      readAt,
      dismissedAt: null,
    });
  }
}

/* ---------------------------------------------------------------------------
 * HTTP
 * ------------------------------------------------------------------------ */

type Caller = { id: string; accountType: AccountType };

const bearer = (request: Request) => request.headers.get("Authorization")?.replace(/^Bearer /, "");

/** JwtAuthGuard: an active staff member or the customer, else a 401 without a code (a deactivated account too). */
function callerOf(request: Request): Caller | undefined {
  const token = bearer(request);
  const staff = staffForToken(token);
  if (staff) return { id: staff.id, accountType: "staff" };
  const customer = customerForToken(token);
  return customer && { id: customer.id, accountType: "customer" };
}

const unauthorized = () => error(401, ["Unauthorized"]);

/** ParseUUIDPipe's pattern: any version. */
const isUuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const badId = () => error(400, ["Validation failed (uuid is expected)"]);
const notFound = (id: string) => error(404, [`Notification ${id} not found`], NOTIFICATION_NOT_FOUND);

const visibleTo = (caller: Caller) =>
  rows.filter((row) => row.userId === caller.id && row.accountType === caller.accountType && !row.dismissedAt);
const findVisible = (caller: Caller, id: string) => visibleTo(caller).find((row) => row.id === id);
const isUnread = (row: Row) => row.status !== "READ";

const newestFirst = (a: Row, b: Row) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

/** NotificationFactory.toDto: no owner, dedupe key or delivery details. */
const toDto = ({ id, type, status, title, message, payload, createdAt, readAt }: Row): AppNotification => ({
  id,
  type,
  status,
  title,
  message,
  payload,
  createdAt,
  readAt,
});

/** ListNotificationsQueryDto under the ValidationPipe: every failing field, as a 400 without a code. */
function queryProblems(params: URLSearchParams) {
  const wholeNumber = (field: string, min: number, max?: number) => {
    const raw = params.get(field);
    if (raw === null) return false;
    const value = Number(raw);
    if (!Number.isInteger(value)) return `${field} must be a whole number`;
    if (value < min) return `${field} must be at least ${min}`;
    return max !== undefined && value > max && `${field} must be at most ${max}`;
  };
  const unreadOnly = params.get("unreadOnly");
  const type = params.get("type");
  return [
    ...[...params.keys()]
      .filter((key) => !["page", "limit", "unreadOnly", "type"].includes(key))
      .map((key) => `${key} is not an allowed field`),
    wholeNumber("page", 1),
    wholeNumber("limit", 1, 100),
    unreadOnly !== null && !["true", "false"].includes(unreadOnly) && "unreadOnly must be true or false",
    type !== null &&
      !(NOTIFICATION_TYPES as readonly string[]).includes(type) &&
      `type must be one of the following values: ${NOTIFICATION_TYPES.join(", ")}`,
  ].filter((problem): problem is string => Boolean(problem));
}

export const notificationHandlers = [
  http.get("*/api/notifications", ({ request }) => {
    const caller = callerOf(request);
    if (!caller) return unauthorized();
    const params = new URL(request.url).searchParams;
    const problems = queryProblems(params);
    if (problems.length > 0) return error(400, problems);

    const unreadOnly = params.get("unreadOnly") === "true";
    const type = params.get("type");
    const items = visibleTo(caller)
      .filter((row) => (!unreadOnly || isUnread(row)) && (!type || row.type === type))
      .sort(newestFirst)
      .map(toDto);
    return paginated(items, Number(params.get("page") ?? 1), Number(params.get("limit") ?? 20));
  }),

  http.get("*/api/notifications/unread-count", ({ request }) => {
    const caller = callerOf(request);
    if (!caller) return unauthorized();
    return ok<NotificationCount>({ count: visibleTo(caller).filter(isUnread).length });
  }),

  http.patch("*/api/notifications/read-all", ({ request }) => {
    const caller = callerOf(request);
    if (!caller) return unauthorized();
    const unread = visibleTo(caller).filter(isUnread);
    const readAt = new Date().toISOString();
    for (const row of unread) Object.assign(row, { status: "READ", readAt });
    return ok<NotificationCount>({ count: unread.length });
  }),

  // Any status; a second call keeps the first readAt.
  http.patch("*/api/notifications/:id/read", ({ params, request }) => {
    const caller = callerOf(request);
    if (!caller) return unauthorized();
    const id = String(params.id);
    if (!isUuid(id)) return badId();
    const row = findVisible(caller, id);
    if (!row) return notFound(id);
    if (isUnread(row)) Object.assign(row, { status: "READ", readAt: new Date().toISOString() });
    return ok(toDto(row));
  }),

  http.delete("*/api/notifications/:id", ({ params, request }) => {
    const caller = callerOf(request);
    if (!caller) return unauthorized();
    const id = String(params.id);
    if (!isUuid(id)) return badId();
    const row = findVisible(caller, id);
    if (!row) return notFound(id);
    row.dismissedAt = new Date().toISOString();
    return ok<MessageResponse>({ message: "Notification dismissed" });
  }),
];
