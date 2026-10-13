import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { msw } from "msw/vite";
import { defineConfig, loadEnv } from "vite";

// One .env at the repo root (the subject asks for a single, git-ignored .env).
const envDir = fileURLToPath(new URL("../../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, "");
  const mocks = env.VITE_API_MOCKS === "true";

  return {
    base: "/admin/",
    envDir,
    // `worker-only`: just serve mockServiceWorker.js; main.tsx starts the worker itself.
    plugins: [react(), tailwindcss(), mocks && msw({ mode: "worker-only" })],
    server: {
      port: 5174,
      strictPort: true,
      // Same-origin /api in dev, like nginx in prod — no CORS setup needed.
      proxy: { "/api": { target: env.API_PROXY_TARGET || "http://localhost:3000", changeOrigin: true, ws: true } },
    },
    preview: { port: 4174, strictPort: true },
  };
});
