import { lazy } from "react";

/*
 * Pages that load their code when first opened, so the first screen (login, or
 * the shell) doesn't wait for every page. The login/register/auth pages, the
 * shell and the small stubs stay in the main bundle. While a page loads on
 * navigation, the current one stays up (navigations are transitions); on a
 * first visit ClientLayout shows a skeleton.
 */
export const ShipmentsPage = lazy(() => import("./shipments").then((m) => ({ default: m.ShipmentsPage })));
export const NewShipmentPage = lazy(() => import("./new-shipment").then((m) => ({ default: m.NewShipmentPage })));
export const ShipmentDetailPage = lazy(() => import("./shipment-detail").then((m) => ({ default: m.ShipmentDetailPage })));
export const CheckoutPage = lazy(() => import("./checkout").then((m) => ({ default: m.CheckoutPage })));
export const MessagesPage = lazy(() => import("./messages").then((m) => ({ default: m.MessagesPage })));
export const ProfilePage = lazy(() => import("./profile").then((m) => ({ default: m.ProfilePage })));
export const LegalPage = lazy(() => import("@trans/ui/blocks/legal-layout").then((m) => ({ default: m.LegalPage })));
