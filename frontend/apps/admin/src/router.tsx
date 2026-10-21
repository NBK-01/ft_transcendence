import { KeyRound, LayoutGrid, MessageSquare, Package } from "lucide-react";
import { Suspense } from "react";
import { createBrowserRouter } from "react-router";

import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { RequireAdmin } from "./features/auth/require-admin";
import { RequireStaff } from "./features/auth/require-staff";
import { AdminLayout } from "./layouts/admin-layout";
import {
  BranchDetailPage,
  BranchesPage,
  ContactsPage,
  LegalPage,
  ProfilePage,
  UsersPage,
} from "./routes/lazy-pages";
import { LoginPage } from "./routes/login";
import { Stub } from "./routes/stub";

/** Served under /admin (Vite `base` + router `basename`), so links here are relative to it. */
export const router = createBrowserRouter(
  [
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
        { index: true, element: <Stub page="dashboard" icon={LayoutGrid} /> },
        { path: "shipments", element: <Stub page="shipments" icon={Package} /> },
        { path: "messages", element: <Stub page="messages" icon={MessageSquare} /> },
        { path: "contacts", element: <ContactsPage /> },
        {
          path: "users",
          element: (
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          ),
        },
        { path: "branches", element: <BranchesPage /> },
        { path: "branches/:id", element: <BranchDetailPage /> },
        {
          path: "api-keys",
          element: (
            <RequireAdmin>
              <Stub page="apiKeys" icon={KeyRound} />
            </RequireAdmin>
          ),
        },
        { path: "profile", element: <ProfilePage /> },
      ],
    },
    { path: "*", element: <NotFoundPage /> },
  ],
  { basename: "/admin" },
);
