import { SetMetadata } from '@nestjs/common';

export const ACCESS_CONTROL_KEYS = {
  PERMISSION: 'access_control:permission',
  ANY_PERMISSION: 'access_control:any_permission',
  ALL_PERMISSIONS: 'access_control:all_permissions',
  ROLE: 'access_control:role',
  ANY_ROLE: 'access_control:any_role',
  ANY_OF: 'access_control:any_of',
  STAFF: 'access_control:staff',
  SKIP: 'access_control:skip',
} as const;

export const RequirePermission = (permission: string) =>
  SetMetadata(ACCESS_CONTROL_KEYS.PERMISSION, permission);
export const RequireAnyPermission = (permissions: string[]) =>
  SetMetadata(ACCESS_CONTROL_KEYS.ANY_PERMISSION, permissions);
export const RequireAllPermissions = (permissions: string[]) =>
  SetMetadata(ACCESS_CONTROL_KEYS.ALL_PERMISSIONS, permissions);
export const RequireRole = (role: string) =>
  SetMetadata(ACCESS_CONTROL_KEYS.ROLE, role);
export const RequireAnyRole = (roles: string[]) =>
  SetMetadata(ACCESS_CONTROL_KEYS.ANY_ROLE, roles);
/** OR across both namespaces — passes if the user has ANY of these as either a role name or a permission name. */
export const RequireAnyOf = (rolesOrPermissions: string[]) =>
  SetMetadata(ACCESS_CONTROL_KEYS.ANY_OF, rolesOrPermissions);
/**
 * "Any authenticated staff member, no specific role/permission needed."
 * Required because AccessControlGuard fails OPEN when no decorator is
 * present — an undecorated route would admit a valid customer token too,
 * since the global JwtAuthGuard only checks signature validity, not which
 * table (User vs InternalUser) issued it. There is no implicit "staff-only
 * but undecorated" state — every staff-facing route needs at least this.
 */
export const RequireStaff = () => SetMetadata(ACCESS_CONTROL_KEYS.STAFF, true);
export const SkipAccessControl = () =>
  SetMetadata(ACCESS_CONTROL_KEYS.SKIP, true);
