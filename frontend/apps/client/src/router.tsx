import { Bell, MessageSquare } from "lucide-react";
import { createBrowserRouter, Navigate } from "react-router";

import { LegalPage } from "@trans/ui/blocks/legal-layout";
import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { ClientLayout } from "./layouts/client-layout";
import { CheckoutPage } from "./routes/checkout";
import { NewShipmentPage } from "./routes/new-shipment";
import { ProfilePage } from "./routes/profile";
import { ShipmentDetailPage } from "./routes/shipment-detail";
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
      // "new" is a static segment, so it wins over ":id".
      { path: "shipments/new", element: <NewShipmentPage /> },
      { path: "shipments/:id", element: <ShipmentDetailPage /> },
      { path: "shipments/:id/checkout", element: <CheckoutPage /> },
      { path: "messages", element: <Stub page="messages" icon={MessageSquare} /> },
      { path: "notifications", element: <Stub page="notifications" icon={Bell} /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  { path: "*", element: <NotFoundPage homeHref="/app" /> },
]);
