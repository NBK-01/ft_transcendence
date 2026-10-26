import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AccountType } from '../../common/context/auth-context.types';
import { NotificationType } from '../../notifications/constants/notification.constants';
import {
  ActionSignals,
  OrganizationDeactivatedSignal,
  OrganizationStaffSignal,
  PasswordChangedSignal,
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

  /** DELETE /organizations/:id, which deactivates. The branch's staff are taken now. */
  @OnEvent(ActionSignals.ORGANIZATION_DEACTIVATED)
  onOrganizationDeactivated({
    organizationId,
  }: OrganizationDeactivatedSignal): void {
    const actor = this.notifier.actor();
    this.notifier.notify(async () => {
      const organization = await this.lookup.findOrganization(organizationId);
      if (!organization) {
        return null;
      }
      return {
        type: NotificationType.BRANCH_DEACTIVATED,
        occurrence: occurrenceOf(organization.id, organization.updatedAt),
        actor,
        data: {
          organizationId,
          name: organization.name,
          staffIds: await this.lookup.findBranchStaffIds(organizationId),
        },
      };
    });
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
