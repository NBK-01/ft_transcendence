import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "./client";
import { keys } from "./keys";
import type { OverviewStats, OverviewStatsQuery } from "./types";

/**
 * GET /admin/stats/overview: shipments created and delivered in a period (and
 * the one before), how many are in each status now, and the latest events with
 * who did them. Needs "shipments:read:all" (admin, support): mount it only for
 * those roles. A status change refreshes it, like the shipments lists. The
 * last numbers stay on screen while another branch's load.
 */
export function useOverviewStats(query: OverviewStatsQuery) {
  return useQuery({
    queryKey: keys.adminShipments.overviewStats(query),
    queryFn: ({ signal }) => api.get<OverviewStats>("/admin/stats/overview", { query, signal }),
    placeholderData: keepPreviousData,
  });
}
