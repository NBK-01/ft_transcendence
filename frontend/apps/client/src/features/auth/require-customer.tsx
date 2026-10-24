import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useSession } from "@trans/api";

/**
 * Wraps every signed-in page. Without a customer session (never signed in, or
 * the session expired) it sends you to /login, remembering the page in
 * `?next=`. Unlike staff's RequireStaff, there's a "loading" state to sit
 * through first: useSession awaits GET /auth/me before it knows.
 */
export function RequireCustomer({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.status === "loading") return null;
  if (session.status === "authenticated") return children;

  const next = `${location.pathname}${location.search}`;
  return <Navigate to={next === "/app" ? "/login" : `/login?${new URLSearchParams({ next }).toString()}`} replace />;
}
