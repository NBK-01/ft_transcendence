import type { UseQueryResult } from "@tanstack/react-query";

type Query = Pick<UseQueryResult<unknown>, "data" | "error" | "isError" | "isFetching" | "isPending" | "refetch">;

/** The loading and error state of one or more queries, as StatCard props. Any of them failing fails the card. */
export function queryState(...queries: Query[]) {
  // A failed refresh keeps the last number on screen; only a first load that failed shows the error.
  const failed = queries.filter((query) => query.isError && query.data === undefined);
  return {
    // Retrying shows the skeleton again, so the click visibly does something.
    isLoading: queries.some((query) => query.isPending) || failed.some((query) => query.isFetching),
    error: failed[0]?.error ?? null,
    onRetry: () => {
      for (const query of failed) void query.refetch();
    },
  };
}
