import type { UseQueryResult } from "@tanstack/react-query";

/** A query's loading and error state, as StatCard props. */
export function queryState(query: UseQueryResult<unknown>) {
  // A failed refresh keeps the last number on screen; only a first load that failed shows the error.
  const failed = query.isError && query.data === undefined;
  return {
    // Retrying shows the skeleton again, so the click visibly does something.
    isLoading: query.isPending || (failed && query.isFetching),
    error: failed ? query.error : null,
    onRetry: () => void query.refetch(),
  };
}
