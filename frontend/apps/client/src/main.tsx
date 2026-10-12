import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import "./styles.css";

import { AppProviders } from "@trans/ui/blocks/app-providers";
import { initI18n } from "@trans/ui/i18n";

import ar from "./i18n/ar";
import en from "./i18n/en";
import fr from "./i18n/fr";
import { router } from "./router";

initI18n({ en, fr, ar });

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
