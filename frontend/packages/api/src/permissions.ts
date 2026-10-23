import { useMemo } from "react";

import { useStaffSession } from "./staff-auth";

/**
 * Which staff role may do what: a copy of the backend's ROLE_PERMISSION_MATRIX
 * (backend/src/access-control/seed-data/rbac-seed-data.ts). Non-admins can't
 * read their own permissions from the API (/access-control is admin-only), so
 * the app carries the table. Keep the two in sync.
 *
 * This only decides what the UI shows. The backend checks every request again
 * and answers 403 (code 7001) when the UI is out of date, e.g. after a role change.
 */
export const ROLE_PERMISSIONS = {
  admin: [
    "organizations:manage",
    "organizations:read",
    "shipments:read:all",
    "shipments:create",
    "shipments:update:org",
    "shipments:assign",
    "shipments:cancel",
    "chat:support:access",
  ],
  dispatcher: [
    "organizations:read",
    "shipments:create",
    "shipments:read:org",
    "shipments:update:org",
    "shipments:assign",
  ],
  driver: ["organizations:read", "shipments:read:own", "shipments:update:own"],
  support: ["organizations:read", "shipments:read:all", "chat:support:access"],
} as const;

export type StaffRole = keyof typeof ROLE_PERMISSIONS;
export type Permission = (typeof ROLE_PERMISSIONS)[StaffRole][number];

/** Backend AccessControlErrorCodes.InsufficientPermissions: the 403 a role gets for something it can't do. */
export const INSUFFICIENT_PERMISSIONS = 7001;

/** Whether `roleName` has `permission`. No role, or one this table doesn't know, has none. */
export function roleCan(roleName: string | null | undefined, permission: Permission) {
  if (!roleName || !Object.hasOwn(ROLE_PERMISSIONS, roleName)) return false;
  return (ROLE_PERMISSIONS[roleName as StaffRole] as readonly Permission[]).includes(permission);
}

/**
 * What the signed-in staff member may see and do, from the role they signed
 * in with. `isAdmin` is for the endpoints the backend limits to the admin role
 * (staff accounts, roles); `can` is for permission checks (e.g. "organizations:manage").
 */
export function useStaffAccess() {
  const { user } = useStaffSession();
  const roleName = user?.roleName ?? null;
  return useMemo(
    () => ({ isAdmin: roleName === "admin", can: (permission: Permission) => roleCan(roleName, permission) }),
    [roleName],
  );
}
