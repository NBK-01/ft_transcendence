import type { RequestHandler } from "msw";
import { setupWorker } from "msw/browser";

import { handlers } from "@trans/api/mocks";

/**
 * Client mock backend: the shared handlers from @trans/api plus every
 * feature's own, picked up from `features/<name>/mocks.ts` automatically.
 * Each of those exports one `handlers` array (only that export is read, so
 * mock data can be exported too). Adding a feature's mocks needs no edit here.
 * Same worker options as @trans/api's startMocks.
 */
const featureHandlers = Object.values(
  import.meta.glob<RequestHandler[]>("./features/*/mocks.ts", { eager: true, import: "handlers" }),
).flat();

export async function startClientMocks(baseUrl: string) {
  const worker = setupWorker(...handlers, ...featureHandlers);
  await worker.start({
    serviceWorker: { url: `${baseUrl}mockServiceWorker.js` },
    onUnhandledFrame: "bypass",
    quiet: true,
  });
}
