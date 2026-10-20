import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import "./styles.css";

import { ApiProvider, configureApi } from "@trans/api";
import { AppProviders } from "@trans/ui/blocks/app-providers";
import { toast } from "@trans/ui/components/toaster";
import { i18next, initI18n } from "@trans/ui/i18n";

import ar from "./i18n/ar";
import en from "./i18n/en";
import fr from "./i18n/fr";
import { router } from "./router";

initI18n({ en, fr, ar });

configureApi({
  baseUrl: import.meta.env.VITE_API_URL || "/api",
  // Staff tokens, kept apart from a customer session on the same origin.
  refreshPath: "/staff-auth/refresh",
  storageKey: "trans-staff-refresh-token",
  // The tokens are already cleared, so RequireStaff sends you to /login (with ?next=); say why.
  onSessionExpired: () => toast(i18next.t("app:login.expired")),
});

// Mock backend (dev only). Dynamic import keeps MSW out of production bundles.
if (import.meta.env.DEV && import.meta.env.VITE_API_MOCKS === "true") {
  const { startMocks } = await import("@trans/api/mocks");
  await startMocks(import.meta.env.BASE_URL);
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
