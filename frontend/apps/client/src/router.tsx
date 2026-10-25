import { Bell } from "lucide-react";
import { createBrowserRouter, Navigate } from "react-router";

import { LegalPage } from "@trans/ui/blocks/legal-layout";
import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { RequireCustomer } from "./features/auth/require-customer";
import { ClientLayout } from "./layouts/client-layout";
import { CheckoutPage } from "./routes/checkout";
import { ForgotPasswordPage } from "./routes/forgot-password";
import { LoginPage } from "./routes/login";
import { MessagesPage } from "./routes/messages";
import { NewShipmentPage } from "./routes/new-shipment";
import { OAuthCallbackPage } from "./routes/oauth-callback";
import { ProfilePage } from "./routes/profile";
import { RegisterPage } from "./routes/register";
import { ResetPasswordPage } from "./routes/reset-password";
import { ShipmentDetailPage } from "./routes/shipment-detail";
import { ShipmentsPage } from "./routes/shipments";
import { Stub } from "./routes/stub";
import { VerifyOtpPage } from "./routes/verify-otp";

export const router = createBrowserRouter([
  { index: true, element: <Navigate to="/app" replace /> },
  { path: "privacy", element: <LegalPage kind="privacy" /> },
  { path: "terms", element: <LegalPage kind="terms" /> },
  { path: "login", element: <LoginPage /> },
  { path: "register", element: <RegisterPage /> },
  { path: "verify-otp", element: <VerifyOtpPage /> },
  { path: "forgot-password", element: <ForgotPasswordPage /> },
  { path: "reset-password", element: <ResetPasswordPage /> },
  { path: "auth/oauth-callback", element: <OAuthCallbackPage /> },
  {
    path: "app",
    element: (
      <RequireCustomer>
        <ClientLayout />
      </RequireCustomer>
    ),
    children: [
      { index: true, element: <ShipmentsPage /> },
      // "new" is a static segment, so it wins over ":id".
      { path: "shipments/new", element: <NewShipmentPage /> },
      { path: "shipments/:id", element: <ShipmentDetailPage /> },
      { path: "shipments/:id/checkout", element: <CheckoutPage /> },
      { path: "messages", element: <MessagesPage /> },
      { path: "notifications", element: <Stub page="notifications" icon={Bell} /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  { path: "*", element: <NotFoundPage homeHref="/app" /> },
]);
