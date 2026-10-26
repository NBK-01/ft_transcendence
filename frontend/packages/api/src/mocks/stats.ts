import { http } from "msw/http";

import type { OverviewStats, PeriodCount, ShipmentActivity, ShipmentState } from "../types";
import { isUuid } from "./data";
import { error, ok } from "./respond";
import { mockShipments, STATES } from "./shipments";

/**
 * GET /admin/stats/overview (backend StatsController and StatsService), over
 * the same in-memory shipments as the shipments mocks, so a status change made
 * there shows here. `requireStaffAccess` (staff-auth.ts) checks the token and
 * "shipments:read:all" first.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;
const RECENT_ACTIVITY_LIMIT = 10;
const QUERY_FIELDS = ["from", "to", "organizationId"];

/** class-validator's IsISO8601({ strict: true }): a date, optionally with a time and an offset. */
const ISO_8601 = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}(?::?\d{2})?)?)?$/;
const isIsoDate = (value: string | null): value is string =>
  value !== null && ISO_8601.test(value) && !Number.isNaN(Date.parse(value));

/** The ValidationPipe's 400, worded like GlobalExceptionFilter (errors.json, or class-validator's own English). */
function problemWith(params: URLSearchParams) {
  const from = params.get("from");
  const to = params.get("to");
  const organizationId = params.get("organizationId");
  const messages = [
    ...[...params.keys()].filter((key) => !QUERY_FIELDS.includes(key)).map((key) => `${key} is not an allowed field`),
    !isIsoDate(from) && "from must be a valid ISO 8601 date string",
    !isIsoDate(to) && "to must be a valid ISO 8601 date string",
    isIsoDate(from) &&
      isIsoDate(to) &&
      !(Date.parse(to) > Date.parse(from) && Date.parse(to) - Date.parse(from) <= MAX_RANGE_DAYS * DAY_MS) &&
      `to must be after from, at most ${MAX_RANGE_DAYS} days later`,
    organizationId !== null && !isUuid(organizationId) && "organizationId must be a valid identifier",
  ].filter((message): message is string => typeof message === "string");
  return messages.length > 0 ? error(400, messages) : undefined;
}

export const statsHandlers = [
  http.get("*/api/admin/stats/overview", ({ request }) => {
    const params = new URL(request.url).searchParams;
    const problem = problemWith(params);
    if (problem) return problem;

    const from = Date.parse(params.get("from")!);
    const to = Date.parse(params.get("to")!);
    const previousFrom = 2 * from - to;
    const organizationId = params.get("organizationId");
    const rows = mockShipments().filter((row) => !organizationId || row.organization?.id === organizationId);

    // The period asked, and the one as long just before it.
    const count = (dates: string[]): PeriodCount => {
      const times = dates.map(Date.parse);
      return {
        current: times.filter((time) => time >= from && time < to).length,
        previous: times.filter((time) => time >= previousFrom && time < from).length,
      };
    };

    const recentActivity = rows
      .flatMap((row) =>
        row.events.map(
          (event): ShipmentActivity => ({
            id: event.id,
            trackingId: row.trackingId,
            status: event.status,
            location: event.location,
            occurredAt: event.occurredAt,
            actor: event.actor,
          }),
        ),
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))
      .slice(0, RECENT_ACTIVITY_LIMIT);

    const stats: OverviewStats = {
      period: {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
        previousFrom: new Date(previousFrom).toISOString(),
      },
      created: count(rows.map((row) => row.createdAt)),
      delivered: count(
        rows.flatMap((row) => row.events.filter((event) => event.status === "delivered").map((event) => event.occurredAt)),
      ),
      byStatus: Object.fromEntries(
        STATES.map((status) => [status, rows.filter((row) => row.status === status).length]),
      ) as Record<ShipmentState, number>,
      recentActivity,
    };
    return ok(stats);
  }),
];
