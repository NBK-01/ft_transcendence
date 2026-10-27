import { useCallback } from "react";
import { useSearchParams } from "react-router";

import { useStaffAccess } from "@trans/api";

import { useOrganizations } from "./api";

const PARAM = "branch";

/**
 * The topbar branch filter, kept in the URL (`?branch=<id>`) so it survives a
 * reload, can be shared as a link and follows the nav links between pages.
 * `null` means every branch. Staff who only work on their own branch's
 * shipments (a dispatcher) have it fixed to their branch: `locked`.
 */
export function useBranchFilter() {
  const [params, setParams] = useSearchParams();
  const organizations = useOrganizations();
  const { branchScoped, organization } = useStaffAccess();
  const requested = params.get(PARAM);
  // An unknown id (stale link, wrong id) counts as every branch once the list is in.
  const branchId =
    requested && (organizations.isPending || organizations.data?.some((org) => org.id === requested))
      ? requested
      : null;

  const setBranchId = useCallback(
    (id: string | null) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (id) next.set(PARAM, id);
          else next.delete(PARAM);
          // Another branch has other pages: start from the first.
          next.delete("page");
          return next;
        },
        // A filter change, not a new page: Back leaves the page instead of undoing it.
        { replace: true },
      ),
    [setParams],
  );

  /**
   * Adds the current filter to a nav link, so it stays on when switching pages.
   * A link with its own query (`/shipments?status=delivered`) keeps it.
   */
  const withBranch = useCallback(
    (to: string) =>
      branchId ? `${to}${to.includes("?") ? "&" : "?"}${new URLSearchParams({ [PARAM]: branchId }).toString()}` : to,
    [branchId],
  );

  if (branchScoped) {
    return { branchId: organization?.id ?? null, setBranchId: noop, withBranch: same, locked: true as const };
  }
  return { branchId, setBranchId, withBranch, locked: false as const };
}

const noop = () => {};
const same = (to: string) => to;
