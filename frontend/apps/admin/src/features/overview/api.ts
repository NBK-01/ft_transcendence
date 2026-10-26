import { useMemo } from "react";

import { useOverviewStats, type PeriodCount } from "@trans/api";
import { SHIPMENT_STATES, type ShipmentState } from "@trans/ui/blocks/shipment-state";

import { useBranchFilter } from "../branches/use-branch-filter";

export type CountedState = Exclude<ShipmentState, "requested">;

/** The statuses the overview counts, in lifecycle order: all but "requested", which nothing sets. */
export const COUNTED_STATES = SHIPMENT_STATES.filter((state): state is CountedState => state !== "requested");

/** Today by the browser's clock, midnight to midnight: the API compares it with yesterday. */
function todayRange(now: Date) {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * GET /admin/stats/overview for today, in the branch picked in the top bar
 * (or all). One request for every number on the overview's shipments section;
 * it moves on to the next day on the first render after midnight. Needs
 * "shipments:read:all" (admin, support): mount it only for those roles.
 */
export function useTodayOverview() {
  const { branchId } = useBranchFilter();
  // Today's local midnight, as a number: the same key all day long.
  const midnight = new Date().setHours(0, 0, 0, 0);
  const query = useMemo(
    () => ({ ...todayRange(new Date(midnight)), organizationId: branchId ?? undefined }),
    [midnight, branchId],
  );
  return useOverviewStats(query);
}

/** The change since yesterday as a fraction (StatCard's `change`), or none when yesterday had nothing to compare with. */
export const changeOf = ({ current, previous }: PeriodCount) =>
  previous > 0 ? (current - previous) / previous : undefined;
