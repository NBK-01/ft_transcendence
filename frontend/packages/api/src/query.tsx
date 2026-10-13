import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { isApiError } from "./errors";

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // 4xx won't fix itself on retry; network/5xx get one more try.
        retry: (failureCount, error) => !(isApiError(error) && error.isClientError) && failureCount < 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

/** Wrap each app once, inside AppProviders. */
export function ApiProvider({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
