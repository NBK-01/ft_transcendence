import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AccountType } from '../../common/context/auth-context.types';
import { NotificationType } from '../../notifications/constants/notification.constants';
import {
  ActionSignals,
  ApiKeySignal,
  CustomerDeactivatedSignal,
  OrganizationDeletedSignal,
  OrganizationStaffSignal,
  PasswordChangedSignal,
  ProfileUpdatedSignal,
  SessionsRevokedSignal,
} from '../../notifications/action-signals';
import { ActionLookupService } from '../../notifications/action-lookup.service';
import {
  ActionNotificationEvent,
  occurrenceOf,
} from '../events/action-notification.event';
import { ActionNotifier } from '../services/action-notifier.service';

/**
 * The trigger for the writes a TypeORM subscriber can't describe
 * (repository.update(): no row, no old values): their services emit an
 * ActionSignal right after the write. Each handler reads who acted while the
 * request runs, then builds the job in the background (ActionNotifier). The
 * occurrence is the row's id and the updatedAt that write gave it.
 * @OnEvent logs a listener's error instead of throwing it into the request.
 */
@Injectable()
export class ActionSignalsListener {
  constructor(
    private readonly notifier: ActionNotifier,
    private readonly lookup: ActionLookupService,
  ) {}

  /** DELETE /organizations/:id: a branch is deleted once, so its id names the occurrence. */
  @OnEvent(ActionSignals.ORGANIZATION_DELETED)
  onOrganizationDeleted({
    organizationId,
    name,
  }: OrganizationDeletedSignal): void {
    const actor = this.notifier.actor();
    this.notifier.notify(() =>
      Promise.resolve({
        type: NotificationType.BRANCH_DELETED,
        occurrence: `${organizationId}-deleted`,
        actor,
        data: { organizationId, name },
      }),
    );
  }

  @OnEvent(ActionSignals.ORGANIZATION_STAFF_ADDED)
  onStaffAdded(signal: OrganizationStaffSignal): void {
    this.membership(NotificationType.BRANCH_STAFF_ADDED, signal);
  }

  @OnEvent(ActionSignals.ORGANIZATION_STAFF_REMOVED)
  onStaffRemoved(signal: OrganizationStaffSignal): void {
    this.membership(NotificationType.BRANCH_STAFF_REMOVED, signal);
  }

  /** Customer change or reset, staff change. Reaches the owner even when they did it. */
  @OnEvent(ActionSignals.PASSWORD_CHANGED)
  onPasswordChanged({ accountType, accountId }: PasswordChangedSignal): void {
    const actor = this.notifier.actor();
    const account = { id: accountId, accountType };
    this.notifier.notify(async () => {
      const updatedAt = await this.lookup.findAccountUpdatedAt(account);
      if (!updatedAt) {
        return null;
      }
      return {
        type: NotificationType.PASSWORD_CHANGED,
        occurrence: occurrenceOf(accountId, updatedAt),
        actor,
        data: { account },
      };
    });
  }

  /** Profile details or photo. The occurrence is the account and the updatedAt the write gave it. */
  @OnEvent(ActionSignals.PROFILE_UPDATED)
  onProfileUpdated({
    accountType,
    accountId,
    change,
  }: ProfileUpdatedSignal): void {
    const actor = this.notifier.actor();
    const account = { id: accountId, accountType };
    this.notifier.notify(async () => {
      const updatedAt = await this.lookup.findAccountUpdatedAt(account);
      if (!updatedAt) {
        return null;
      }
      return {
        type: NotificationType.PROFILE_UPDATED,
        occurrence: occurrenceOf(accountId, updatedAt),
        actor,
        data: { account, change },
      };
    });
  }

  /** A customer closed their account (it can't be reopened). */
  @OnEvent(ActionSignals.CUSTOMER_DEACTIVATED)
  onCustomerDeactivated({ customerId }: CustomerDeactivatedSignal): void {
    const actor = this.notifier.actor();
    this.notifier.notify(() =>
      Promise.resolve({
        type: NotificationType.CUSTOMER_ACCOUNT_DEACTIVATED,
        occurrence: `${customerId}-deactivated`,
        actor,
        data: { customerId },
      }),
    );
  }

  /** Nothing on the account row changes: the time of the request names this one. */
  @OnEvent(ActionSignals.SESSIONS_REVOKED)
  onSessionsRevoked({ accountType, accountId }: SessionsRevokedSignal): void {
    const actor = this.notifier.actor();
    const occurrence = `${accountId}-${Date.now()}`;
    this.notifier.notify(() =>
      Promise.resolve({
        type: NotificationType.SESSIONS_REVOKED,
        occurrence,
        actor,
        data: { account: { id: accountId, accountType } },
      }),
    );
  }

  /** A key is created once: its id is the occurrence. */
  @OnEvent(ActionSignals.API_KEY_CREATED)
  onApiKeyCreated(signal: ApiKeySignal): void {
    const actor = this.notifier.actor();
    this.notifier.notify(() =>
      Promise.resolve({
        type: NotificationType.API_KEY_CREATED,
        occurrence: signal.apiKeyId,
        actor,
        data: signal,
      }),
    );
  }

  /** And revoked at most once (ApiKeysService only signals the revoke that changed it). */
  @OnEvent(ActionSignals.API_KEY_REVOKED)
  onApiKeyRevoked(signal: ApiKeySignal): void {
    const actor = this.notifier.actor();
    this.notifier.notify(() =>
      Promise.resolve({
        type: NotificationType.API_KEY_REVOKED,
        occurrence: `${signal.apiKeyId}-revoked`,
        actor,
        data: signal,
      }),
    );
  }

  private membership(
    type:
      | NotificationType.BRANCH_STAFF_ADDED
      | NotificationType.BRANCH_STAFF_REMOVED,
    { organizationId, internalUserId }: OrganizationStaffSignal,
  ): void {
    const actor = this.notifier.actor();
    this.notifier.notify(async (): Promise<ActionNotificationEvent | null> => {
      const [organization, updatedAt] = await Promise.all([
        this.lookup.findOrganization(organizationId),
        this.lookup.findAccountUpdatedAt({
          id: internalUserId,
          accountType: AccountType.STAFF,
        }),
      ]);
      if (!organization || !updatedAt) {
        return null;
      }
      const occurrence = occurrenceOf(internalUserId, updatedAt);
      const data = { organizationId, name: organization.name, internalUserId };
      return type === NotificationType.BRANCH_STAFF_ADDED
        ? { type, occurrence, actor, data }
        : { type, occurrence, actor, data };
    });
  }
}
