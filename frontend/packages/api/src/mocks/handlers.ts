import { authHandlers } from "./auth";
import { chatHandlers } from "./chat";
import { contactHandlers } from "./contacts";
import { organizationHandlers } from "./organizations";
import { shipmentHandlers } from "./shipments";
import { staffHandlers } from "./staff";
import { requireStaffAccess, staffAuthHandlers } from "./staff-auth";

export { error, ok, paginated } from "./respond";

/**
 * Mock backend for development (VITE_API_MOCKS=true).
 * Each handler mirrors a real endpoint's contract, including errors, so the
 * screens behave the same against mocks and the real API.
 *
 * When the real endpoint ships: delete its handler here. Nothing else changes.
 * Requests with no handler pass through to the real backend (Vite proxy).
 */
export const handlers = [
  ...authHandlers,
  ...staffAuthHandlers,
  // Before the staff-only handlers: 401 without a staff token, 403 for a role without access.
  requireStaffAccess,
  ...staffHandlers,
  ...organizationHandlers,
  ...contactHandlers,
  ...chatHandlers,
  ...shipmentHandlers,
];
