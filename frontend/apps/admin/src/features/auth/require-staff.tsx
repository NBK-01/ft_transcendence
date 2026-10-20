import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";

import { useStaffSession } from "@trans/api";

/**
 * Wraps every signed-in page. Without a staff session (never signed in, or the
 * session expired) it sends you to /login, remembering the page in `?next=`.
 * After signing out on purpose there's no `?next=`: the next person to sign in
 * starts on the overview, not on the page the last one left.
 */
export function RequireStaff({ children }: { children: ReactNode }) {
  const session = useStaffSession();
  const location = useLocation();

  if (session.status === "authenticated") return children;
  if (session.signedOut) return <Navigate to="/login" replace />;

  const next = `${location.pathname}${location.search}`;
  return <Navigate to={next === "/" ? "/login" : `/login?${new URLSearchParams({ next }).toString()}`} replace />;
}
