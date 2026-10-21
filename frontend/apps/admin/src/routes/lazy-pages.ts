import { lazy } from "react";

/*
 * Pages that load their code when first opened, so the first screen (login, or
 * the shell) doesn't wait for every page. The login page, the shell and the
 * small stubs stay in the main bundle. While a page loads on navigation, the
 * current one stays up (navigations are transitions); on a first visit
 * AdminLayout shows a skeleton.
 */
export const UsersPage = lazy(() => import("./users").then((m) => ({ default: m.UsersPage })));
export const BranchesPage = lazy(() => import("./branches").then((m) => ({ default: m.BranchesPage })));
export const BranchDetailPage = lazy(() => import("./branch-detail").then((m) => ({ default: m.BranchDetailPage })));
export const ContactsPage = lazy(() => import("./contacts").then((m) => ({ default: m.ContactsPage })));
export const ProfilePage = lazy(() => import("./profile").then((m) => ({ default: m.ProfilePage })));
export const LegalPage = lazy(() => import("@trans/ui/blocks/legal-layout").then((m) => ({ default: m.LegalPage })));
