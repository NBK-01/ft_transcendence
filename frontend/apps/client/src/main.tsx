import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import "./styles.css";

import { ApiProvider, configureApi } from "@trans/api";
import { AppProviders } from "@trans/ui/blocks/app-providers";
import { initI18n } from "@trans/ui/i18n";

import ar from "./i18n/ar";
import en from "./i18n/en";
import fr from "./i18n/fr";
import { router } from "./router";

initI18n({ en, fr, ar });

configureApi({
  baseUrl: import.meta.env.VITE_API_URL || "/api",
  onSessionExpired: () => void router.navigate("/login"),
});

// Mock backend (dev only). Dynamic import keeps MSW out of production bundles.
if (import.meta.env.DEV && import.meta.env.VITE_API_MOCKS === "true") {
  const { startClientMocks } = await import("./mocks");
  await startClientMocks(import.meta.env.BASE_URL);
}

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <ApiProvider>
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>
    </ApiProvider>
  </StrictMode>,
);
