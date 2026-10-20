import { KeyRound, LayoutGrid, MessageSquare, Package, UserRound } from "lucide-react";
import { createBrowserRouter } from "react-router";

import { LegalPage } from "@trans/ui/blocks/legal-layout";
import { NotFoundPage } from "@trans/ui/blocks/not-found-page";

import { RequireStaff } from "./features/auth/require-staff";
import { AdminLayout } from "./layouts/admin-layout";
import { BranchDetailPage } from "./routes/branch-detail";
import { BranchesPage } from "./routes/branches";
import { LoginPage } from "./routes/login";
import { Stub } from "./routes/stub";
import { UsersPage } from "./routes/users";

/** Served under /admin (Vite `base` + router `basename`), so links here are relative to it. */
export const router = createBrowserRouter(
  [
    { path: "privacy", element: <LegalPage kind="privacy" /> },
    { path: "terms", element: <LegalPage kind="terms" /> },
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
        { path: "users", element: <UsersPage /> },
        { path: "branches", element: <BranchesPage /> },
        { path: "branches/:id", element: <BranchDetailPage /> },
        { path: "api-keys", element: <Stub page="apiKeys" icon={KeyRound} /> },
        { path: "profile", element: <Stub page="profile" icon={UserRound} /> },
      ],
    },
    { path: "*", element: <NotFoundPage /> },
  ],
  { basename: "/admin" },
);
