import { Suspense } from "react";
import { createBrowserRouter } from "react-router";

import { ErrorFallback } from "@trans/ui/blocks/error-boundary";
import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { RequireAdmin, RequirePermission } from "./features/auth/require-admin";
import { SHIPMENT_READ } from "./features/auth/shipment-read";
import { RequireStaff } from "./features/auth/require-staff";
import { AdminLayout } from "./layouts/admin-layout";
import {
  ApiKeysPage,
  BranchDetailPage,
  BranchesPage,
  ContactsPage,
  LegalPage,
  MessagesPage,
  OverviewPage,
  ProfilePage,
  RolesPage,
  ShipmentDetailPage,
  ShipmentsPage,
  StaffProfilePage,
  UsersPage,
} from "./routes/lazy-pages";
import { LoginPage } from "./routes/login";

/** Served under /admin (Vite `base` + router `basename`), so links here are relative to it. */
export const router = createBrowserRouter(
  [
    {
      // Pathless root: a data router catches render errors per matched route tree,
      // so one `errorElement` here is the only way to cover every route below.
      errorElement: <ErrorFallback />,
      children: [
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
        {
          path: "/",
          element: (
            <RequireStaff>
              <AdminLayout />
            </RequireStaff>
          ),
          children: [
            { index: true, element: <OverviewPage /> },
            {
              path: "shipments",
              element: (
                <RequirePermission permission={SHIPMENT_READ}>
                  <ShipmentsPage />
                </RequirePermission>
              ),
            },
            {
              path: "shipments/:trackingId",
              element: (
                <RequirePermission permission={SHIPMENT_READ}>
                  <ShipmentDetailPage />
                </RequirePermission>
              ),
            },
            { path: "messages", element: <MessagesPage /> },
            { path: "messages/:id", element: <MessagesPage /> },
            { path: "contacts", element: <ContactsPage /> },
            {
              path: "users",
              element: (
                <RequireAdmin>
                  <UsersPage />
                </RequireAdmin>
              ),
            },
            {
              path: "roles",
              element: (
                <RequireAdmin>
                  <RolesPage />
                </RequireAdmin>
              ),
            },
            { path: "branches", element: <BranchesPage /> },
            { path: "branches/:id", element: <BranchDetailPage /> },
            {
              path: "api-keys",
              element: (
                <RequireAdmin>
                  <ApiKeysPage />
                </RequireAdmin>
              ),
            },
            { path: "profile", element: <ProfilePage /> },
            // Any colleague's page; every role may see one.
            { path: "profile/:id", element: <StaffProfilePage /> },
          ],
        },
        { path: "*", element: <NotFoundPage /> },
      ],
    },
  ],
  { basename: "/admin" },
);
