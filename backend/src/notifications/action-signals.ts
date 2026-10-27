import { AccountType } from '../common/context/auth-context.types';
import { ProfileChange } from './constants/notification.constants';

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
  /** ApiKeysService.create. */
  API_KEY_CREATED: 'api-key.created',
  /** ApiKeysService.revoke, only when it actually revoked the key. */
  API_KEY_REVOKED: 'api-key.revoked',
  /** UsersService.updateProfile (only when something changed) and updateAvatar. */
  PROFILE_UPDATED: 'profile.updated',
  /** UsersService.deactivate: a customer closed their account (DELETE /auth/account). */
  CUSTOMER_DEACTIVATED: 'customer.deactivated',
  /** AuthService / StaffAuthService.logoutAll. */
  SESSIONS_REVOKED: 'sessions.revoked',
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

export interface ProfileUpdatedSignal {
  accountType: AccountType;
  accountId: string;
  change: ProfileChange;
}

export interface CustomerDeactivatedSignal {
  customerId: string;
}

export interface SessionsRevokedSignal {
  accountType: AccountType;
  accountId: string;
}

/** Everything the notification needs, taken when the key is created or revoked. */
export interface ApiKeySignal {
  apiKeyId: string;
  name: string;
  organizationId: string;
  branchName: string;
  maskedKey: string;
}
