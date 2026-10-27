import { lazy } from "react";

/*
 * Pages that load their code when first opened, so the first screen (login, or
 * the shell) doesn't wait for every page. The login page and the shell stay
 * in the main bundle. While a page loads on navigation, the
 * current one stays up (navigations are transitions); on a first visit
 * AdminLayout shows a skeleton.
 */
export const OverviewPage = lazy(() => import("./overview").then((m) => ({ default: m.OverviewPage })));
export const ShipmentsPage = lazy(() => import("./shipments").then((m) => ({ default: m.ShipmentsPage })));
export const ShipmentDetailPage = lazy(() => import("./shipment-detail").then((m) => ({ default: m.ShipmentDetailPage })));
export const UsersPage = lazy(() => import("./users").then((m) => ({ default: m.UsersPage })));
export const RolesPage = lazy(() => import("./roles").then((m) => ({ default: m.RolesPage })));
export const BranchesPage = lazy(() => import("./branches").then((m) => ({ default: m.BranchesPage })));
export const BranchDetailPage = lazy(() => import("./branch-detail").then((m) => ({ default: m.BranchDetailPage })));
export const ContactsPage = lazy(() => import("./contacts").then((m) => ({ default: m.ContactsPage })));
export const MessagesPage = lazy(() => import("./messages").then((m) => ({ default: m.MessagesPage })));
export const ProfilePage = lazy(() => import("./profile").then((m) => ({ default: m.ProfilePage })));
export const ApiKeysPage = lazy(() => import("./api-keys").then((m) => ({ default: m.ApiKeysPage })));
export const LegalPage = lazy(() => import("@trans/ui/blocks/legal-layout").then((m) => ({ default: m.LegalPage })));
