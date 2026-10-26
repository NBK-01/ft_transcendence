import { Bell } from "lucide-react";
import { Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { ErrorFallback } from "@trans/ui/blocks/error-boundary";
import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { RequireCustomer } from "./features/auth/require-customer";
import { ClientLayout } from "./layouts/client-layout";
import { ForgotPasswordPage } from "./routes/forgot-password";
import {
  CheckoutPage,
  LegalPage,
  MessagesPage,
  NewShipmentPage,
  ProfilePage,
  ShipmentDetailPage,
  ShipmentsPage,
} from "./routes/lazy-pages";
import { LoginPage } from "./routes/login";
import { OAuthCallbackPage } from "./routes/oauth-callback";
import { RegisterPage } from "./routes/register";
import { ResetPasswordPage } from "./routes/reset-password";
import { Stub } from "./routes/stub";
import { VerifyOtpPage } from "./routes/verify-otp";

export const router = createBrowserRouter([
  {
    // Pathless root: a data router catches render errors per matched route tree,
    // so one `errorElement` here is the only way to cover every route below.
    errorElement: <ErrorFallback />,
    children: [
      { index: true, element: <Navigate to="/app" replace /> },
      {
        path: "privacy",
        element: (
          <Suspense>
            <LegalPage kind="privacy" />
          </Suspense>
        ),
      },
      {
        path: "terms",
        element: (
          <Suspense>
            <LegalPage kind="terms" />
          </Suspense>
        ),
      },
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
    ],
  },
]);
