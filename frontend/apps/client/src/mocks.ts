import type { RequestHandler } from "msw";
import { setupWorker } from "msw/browser";

import { handlers } from "@trans/api/mocks";

/**
 * Client mock backend: the shared handlers from @trans/api plus every
 * feature's own, picked up from `features/<name>/mocks.ts` automatically —
 * each exports an array of handlers. Adding a feature's mocks needs no edit here.
 * Same worker options as @trans/api's startMocks.
 */
const featureHandlers = Object.values(
  import.meta.glob<Record<string, unknown>>("./features/*/mocks.ts", { eager: true }),
).flatMap((module) => Object.values(module).filter(Array.isArray).flat() as RequestHandler[]);

export async function startClientMocks(baseUrl: string) {
  const worker = setupWorker(...handlers, ...featureHandlers);
  await worker.start({
    serviceWorker: { url: `${baseUrl}mockServiceWorker.js` },
    onUnhandledFrame: "bypass",
    quiet: true,
  });
}
