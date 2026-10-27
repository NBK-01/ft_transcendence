import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AccountType } from '../common/context/auth-context.types';
import { InternalUser } from '../internal-users/internal-user.entity';
import { Organization } from '../organizations/organization.entity';
import { Contact } from '../contacts/contact.entity';
import { User } from '../users/user.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { CHAT_SUPPORT_ACCESS_PERMISSION } from '../chat/chat.constants';
import { NotificationRecipient } from './notifications.service';
import { findActiveStaffWithPermission } from './staff-with-permission';

/** Only admins hold it today (RBAC seed), so "the admins" are the staff who can manage branches. */
export const ORGANIZATIONS_MANAGE_PERMISSION = 'organizations:manage';

export interface StaffSummary {
  id: string;
  name: string;
  roleName: string | null;
  organizationId: string | null;
  organizationName: string | null;
}

export interface ContactSummary {
  requester: { id: string; name: string };
  addressee: { id: string; name: string };
}

/**
 * Read-only lookups for the ACTION_NOTIFICATION job and its triggers: who
 * the admins are, who's still active, and the names a notification shows.
 * Missing rows come back null: the job then has nothing to say.
 */
@Injectable()
export class ActionLookupService {
  // One repository per table it reads; nothing here writes.
  constructor(
    @InjectRepository(InternalUser)
    private readonly internalUserRepository: Repository<InternalUser>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
  ) {}

  findAdmins(): Promise<NotificationRecipient[]> {
    return findActiveStaffWithPermission(
      this.internalUserRepository,
      ORGANIZATIONS_MANAGE_PERMISSION,
    );
  }

  findSupportStaff(): Promise<NotificationRecipient[]> {
    return findActiveStaffWithPermission(
      this.internalUserRepository,
      CHAT_SUPPORT_ACCESS_PERMISSION,
    );
  }

  /** The recipients whose account is still active, staff and customers alike: the only ones notified. */
  async keepActive(
    recipients: NotificationRecipient[],
  ): Promise<NotificationRecipient[]> {
    const idsOf = (accountType: AccountType) =>
      recipients
        .filter((recipient) => recipient.accountType === accountType)
        .map(({ id }) => id);
    const staffIds = idsOf(AccountType.STAFF);
    const customerIds = idsOf(AccountType.CUSTOMER);
    const query = (ids: string[]) => ({
      where: { id: In(ids), isActive: true },
      select: { id: true },
    });
    const [staff, customers] = await Promise.all([
      staffIds.length
        ? this.internalUserRepository.find(query(staffIds))
        : Promise.resolve([]),
      customerIds.length
        ? this.userRepository.find(query(customerIds))
        : Promise.resolve([]),
    ]);
    const active = new Set([
      ...staff.map(({ id }) => `${AccountType.STAFF}:${id}`),
      ...customers.map(({ id }) => `${AccountType.CUSTOMER}:${id}`),
    ]);
    return recipients.filter(({ id, accountType }) =>
      active.has(`${accountType}:${id}`),
    );
  }

  /** Everyone assigned to the branch, active or not (the job keeps the active ones). */
  async findBranchStaffIds(organizationId: string): Promise<string[]> {
    const rows = await this.internalUserRepository.find({
      where: { organizationId },
      select: { id: true },
    });
    return rows.map(({ id }) => id);
  }

  findOrganization(id: string): Promise<Organization | null> {
    return this.organizationRepository.findOne({ where: { id } });
  }

  async findStaff(id: string): Promise<StaffSummary | null> {
    const staff = await this.internalUserRepository.findOne({
      where: { id },
      relations: { role: true, organization: true },
    });
    return (
      staff && {
        id: staff.id,
        name: staff.name,
        roleName: staff.role?.name ?? null,
        organizationId: staff.organizationId,
        organizationName: staff.organization?.name ?? null,
      }
    );
  }

  async findContact(id: string): Promise<ContactSummary | null> {
    const contact = await this.contactRepository.findOne({
      where: { id },
      relations: { requester: true, addressee: true },
    });
    return (
      contact && {
        requester: { id: contact.requesterId, name: contact.requester.name },
        addressee: { id: contact.addresseeId, name: contact.addressee.name },
      }
    );
  }

  async findCustomerName(id: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: { id: true, name: true },
    });
    return user?.name ?? null;
  }

  findShipment(id: string): Promise<Shipment | null> {
    return this.shipmentRepository.findOne({ where: { id } });
  }

  /** When the account last changed: with its id, it names one password change. */
  async findAccountUpdatedAt(
    account: NotificationRecipient,
  ): Promise<Date | null> {
    const query = {
      where: { id: account.id },
      select: { id: true, updatedAt: true },
    };
    const row =
      account.accountType === AccountType.STAFF
        ? await this.internalUserRepository.findOne(query)
        : await this.userRepository.findOne(query);
    return row?.updatedAt ?? null;
  }
}
