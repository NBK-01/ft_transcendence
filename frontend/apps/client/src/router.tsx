import { Bell, MessageSquare, Package } from "lucide-react";
import { createBrowserRouter, Navigate } from "react-router";

import { LegalPage } from "@trans/ui/blocks/legal-layout";
import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { ClientLayout } from "./layouts/client-layout";
import { ProfilePage } from "./routes/profile";
import { Stub } from "./routes/stub";

export const router = createBrowserRouter([
  { index: true, element: <Navigate to="/app" replace /> },
  { path: "privacy", element: <LegalPage kind="privacy" /> },
  { path: "terms", element: <LegalPage kind="terms" /> },
  {
    path: "app",
    element: <ClientLayout />,
    children: [
      { index: true, element: <Stub page="shipments" icon={Package} /> },
      { path: "messages", element: <Stub page="messages" icon={MessageSquare} /> },
      { path: "notifications", element: <Stub page="notifications" icon={Bell} /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  { path: "*", element: <NotFoundPage homeHref="/app" /> },
]);
