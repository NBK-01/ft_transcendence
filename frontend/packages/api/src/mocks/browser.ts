import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

/**
 * Start the mock backend in the browser. Apps call this from main.tsx only
 * when VITE_API_MOCKS=true (dynamic import, so it's never in a prod bundle).
 * The worker script is served by the `msw/vite` plugin at `${BASE_URL}mockServiceWorker.js`.
 */
export async function startMocks(baseUrl: string) {
  const worker = setupWorker(...handlers);
  await worker.start({
    serviceWorker: { url: `${baseUrl}mockServiceWorker.js` },
    // Unmocked requests go to the real backend without console noise.
    onUnhandledFrame: "bypass",
    quiet: true,
  });
}

export { handlers };
/** Response helpers for app-level mock handlers, so every mock is enveloped like the real API. */
export { error, ok, paginated } from "./handlers";
