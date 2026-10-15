import { setupWorker } from "msw/browser";

import { handlers } from "@trans/api/mocks";

import { shipmentHandlers } from "./features/shipments/mocks";

/**
 * Client mock backend: the shared handlers from @trans/api plus the
 * client-only ones. Same worker options as @trans/api's startMocks.
 */
export async function startClientMocks(baseUrl: string) {
  const worker = setupWorker(...handlers, ...shipmentHandlers);
  await worker.start({
    serviceWorker: { url: `${baseUrl}mockServiceWorker.js` },
    onUnhandledFrame: "bypass",
    quiet: true,
  });
}
