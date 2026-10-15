import { Bell, MessageSquare, UserRound } from "lucide-react";
import { createBrowserRouter, Navigate } from "react-router";

import { LegalPage } from "@trans/ui/blocks/legal-layout";
import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { ClientLayout } from "./layouts/client-layout";
import { ShipmentsPage } from "./routes/shipments";
import { Stub } from "./routes/stub";

export const router = createBrowserRouter([
  { index: true, element: <Navigate to="/app" replace /> },
  { path: "privacy", element: <LegalPage kind="privacy" /> },
  { path: "terms", element: <LegalPage kind="terms" /> },
  {
    path: "app",
    element: <ClientLayout />,
    children: [
      { index: true, element: <ShipmentsPage /> },
      { path: "messages", element: <Stub page="messages" icon={MessageSquare} /> },
      { path: "notifications", element: <Stub page="notifications" icon={Bell} /> },
      { path: "profile", element: <Stub page="profile" icon={UserRound} /> },
    ],
  },
  { path: "*", element: <NotFoundPage homeHref="/app" /> },
]);
