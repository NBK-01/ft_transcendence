import { http } from "msw/http";

import { NOTIFICATION_NOT_FOUND } from "../notifications";
import type { AccountType, AppNotification, MessageResponse, NotificationCount, NotificationType } from "../types";
import { customerForToken } from "./auth";
import { rows, type Row } from "./notification-store";
import { error, ok, paginated } from "./respond";
import { staffForToken } from "./staff-auth";

/**
 * Notifications (backend NotificationsController), for customers and staff
 * alike: a customer token (the client app, always Amina) or an active staff
 * token. Each sees only their own; someone else's id is a 404 (12001), like a
 * dismissed or unknown one. The backend's order: the token (401), the id
 * (400 if it isn't a UUID), then the notification (404).
 *
 * The rows live in notification-store.ts. The mocks that change things add
 * them there like the backend's jobs do (shipment events, branches, staff
 * accounts, contacts, support conversations, shipment files, passwords), and
 * seed the last days. In-memory, like the rest.
 */

const NOTIFICATION_TYPES: readonly NotificationType[] = [
  "SHIPMENT_UPDATE",
  "BRANCH_CREATED",
  "BRANCH_UPDATED",
  "BRANCH_DEACTIVATED",
  "BRANCH_STAFF_ADDED",
  "BRANCH_STAFF_REMOVED",
  "STAFF_ACCOUNT_CREATED",
  "STAFF_ACCOUNT_UPDATED",
  "STAFF_ACCOUNT_DEACTIVATED",
  "CONTACT_REQUEST_RECEIVED",
  "CONTACT_REQUEST_ACCEPTED",
  "SUPPORT_CONVERSATION_STARTED",
  "SHIPMENT_FILE_ADDED",
  "PASSWORD_CHANGED",
];

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

/** NotificationFactory.toDto: no owner, dedupe key or delivery details. Rebuilt field by field, so TypeScript can't pair type and payload again. */
const toDto = ({ id, type, status, title, message, payload, createdAt, readAt }: Row) =>
  ({ id, type, status, title, message, payload, createdAt, readAt }) as AppNotification;

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
