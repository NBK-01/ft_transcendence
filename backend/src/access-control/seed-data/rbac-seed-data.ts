/**
 * Single source of truth for the seeded roles/permissions/matrix — referenced
 * when hand-writing the migration's seed INSERTs so they can't drift from
 * this list. "customer" is NOT a role here — customers are a structurally
 * separate table (User) with no role at all.
 */

export const ROLE_NAMES = ['admin', 'dispatcher', 'driver', 'support'] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const PERMISSIONS: { name: string; description: string }[] = [
  {
    name: 'organizations:manage',
    description:
      'Create, update, deactivate organizations and manage staff membership',
  },
  {
    name: 'organizations:read',
    description: 'View organizations and their staff',
  },
  // Preview set for the upcoming Shipments phase — seeded now so the matrix below is complete.
  { name: 'shipments:create', description: 'Create a new shipment' },
  {
    name: 'shipments:read:own',
    description: 'Read shipments assigned directly to the caller',
  },
  {
    name: 'shipments:read:org',
    description: "Read shipments within the caller's organization",
  },
  {
    name: 'shipments:read:all',
    description: 'Read any shipment, any organization',
  },
  {
    name: 'shipments:update:own',
    description: 'Update shipments assigned directly to the caller',
  },
  {
    name: 'shipments:update:org',
    description: "Update shipments within the caller's organization",
  },
  { name: 'shipments:assign', description: 'Assign a shipment to a driver' },
  { name: 'shipments:cancel', description: 'Cancel a shipment' },
];

export const ROLE_PERMISSION_MATRIX: Record<RoleName, string[]> = {
  admin: [
    'organizations:manage',
    'organizations:read',
    'shipments:read:all',
    'shipments:create',
    'shipments:update:org',
    'shipments:assign',
    'shipments:cancel',
  ],
  dispatcher: [
    'organizations:read',
    'shipments:create',
    'shipments:read:org',
    'shipments:update:org',
    'shipments:assign',
  ],
  driver: ['organizations:read', 'shipments:read:own', 'shipments:update:own'],
  support: ['organizations:read', 'shipments:read:all'],
};
