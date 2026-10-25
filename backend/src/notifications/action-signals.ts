import { AccountType } from '../common/context/auth-context.types';

/**
 * Events a few services emit (EventEmitter2) right after a write that a
 * TypeORM subscriber can't see: repository.update() carries no entity and
 * no old values. Emit them only once the write is done (outside a
 * transaction, or after it commits). QueuesModule's ActionSignalsListener
 * turns them into notifications; nothing else depends on them.
 */
export const ActionSignals = {
  /** OrganizationsService.deactivate (DELETE /organizations/:id). */
  ORGANIZATION_DEACTIVATED: 'organization.deactivated',
  /** OrganizationsService.assignStaff. */
  ORGANIZATION_STAFF_ADDED: 'organization.staff-added',
  /** OrganizationsService.removeStaff, with the branch they were in. */
  ORGANIZATION_STAFF_REMOVED: 'organization.staff-removed',
  /** UsersService / InternalUsersService.updatePasswordHash (change and reset). */
  PASSWORD_CHANGED: 'password.changed',
} as const;

export interface OrganizationDeactivatedSignal {
  organizationId: string;
}

export interface OrganizationStaffSignal {
  organizationId: string;
  internalUserId: string;
}

export interface PasswordChangedSignal {
  accountType: AccountType;
  accountId: string;
}
