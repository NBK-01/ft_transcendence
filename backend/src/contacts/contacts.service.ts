import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, ContactStatus } from './contact.entity';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { AccessControlService } from '../access-control/access-control.service';
import { isUniqueConstraintViolation } from '../common/utils/database-errors';
import { ContactDto } from './dto/contact.dto';
import { ContactFactory } from './factories/contact.factory';
import {
  ContactNotFoundException,
  ContactAlreadyExistsException,
  ContactScopeViolationException,
  ContactSelfRequestException,
  ContactNotPendingException,
} from './exceptions';

const RELATIONS = ['requester', 'addressee'];

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    private readonly internalUsersService: InternalUsersService,
    private readonly accessControlService: AccessControlService,
  ) {}

  async sendRequest(
    requesterId: string,
    addresseeId: string,
  ): Promise<ContactDto> {
    this.assertNotSelf(requesterId, addresseeId);
    await this.assertSameScope(requesterId, addresseeId);
    await this.assertNoExistingContact(requesterId, addresseeId);
    const contact = await this.insertContact(requesterId, addresseeId);
    return this.getDtoOrThrow(contact.id);
  }

  async acceptRequest(contactId: string, actorId: string): Promise<ContactDto> {
    const contact = await this.getPendingRequestOrThrow(contactId);
    this.assertIsAddressee(contact, actorId);
    contact.status = ContactStatus.ACCEPTED;
    await this.contactRepository.save(contact);
    return this.getDtoOrThrow(contact.id);
  }

  async rejectRequest(contactId: string, actorId: string): Promise<void> {
    const contact = await this.getPendingRequestOrThrow(contactId);
    this.assertIsAddressee(contact, actorId);
    await this.contactRepository.remove(contact);
  }

  async blockContact(contactId: string, actorId: string): Promise<ContactDto> {
    const contact = await this.getContactOrThrow(contactId);
    this.assertIsParty(contact, actorId);
    contact.status = ContactStatus.BLOCKED;
    await this.contactRepository.save(contact);
    return this.getDtoOrThrow(contact.id);
  }

  async removeContact(contactId: string, actorId: string): Promise<void> {
    const contact = await this.getContactOrThrow(contactId);
    this.assertIsParty(contact, actorId);
    await this.contactRepository.remove(contact);
  }

  async listContacts(
    actorId: string,
    status?: ContactStatus,
  ): Promise<ContactDto[]> {
    const contacts = await this.contactRepository.find({
      where: [
        { requesterId: actorId, ...(status ? { status } : {}) },
        { addresseeId: actorId, ...(status ? { status } : {}) },
      ],
      relations: RELATIONS,
    });
    return ContactFactory.toDtoArray(contacts);
  }

  /** The one place "are these two staff connected" is answered — Chat re-checks this on every message send. */
  async areConnected(
    internalUserIdA: string,
    internalUserIdB: string,
  ): Promise<boolean> {
    const contact = await this.contactRepository.findOne({
      where: [
        {
          requesterId: internalUserIdA,
          addresseeId: internalUserIdB,
          status: ContactStatus.ACCEPTED,
        },
        {
          requesterId: internalUserIdB,
          addresseeId: internalUserIdA,
          status: ContactStatus.ACCEPTED,
        },
      ],
    });
    return contact !== null;
  }

  private assertNotSelf(requesterId: string, addresseeId: string): void {
    if (requesterId === addresseeId) {
      throw new ContactSelfRequestException();
    }
  }

  private async assertSameScope(
    requesterId: string,
    addresseeId: string,
  ): Promise<void> {
    const [requester, addressee] = await Promise.all([
      this.internalUsersService.findById(requesterId),
      this.internalUsersService.findById(addresseeId),
    ]);
    if (!requester || !addressee) {
      throw new ContactScopeViolationException();
    }
    if (
      this.shareAnOrganization(
        requester.organizationId,
        addressee.organizationId,
      )
    ) {
      return;
    }
    if (await this.eitherIsAdmin(requesterId, addresseeId)) {
      return;
    }
    throw new ContactScopeViolationException();
  }

  private shareAnOrganization(
    organizationIdA: string | null,
    organizationIdB: string | null,
  ): boolean {
    return organizationIdA !== null && organizationIdA === organizationIdB;
  }

  /**
   * Calls isAdmin() explicitly rather than inferring admin-ness from a null
   * organizationId — a staff member merely pending org assignment also has
   * a null organizationId without being admin, and inferring from nullness
   * would let them bypass scoping entirely.
   */
  private async eitherIsAdmin(
    internalUserIdA: string,
    internalUserIdB: string,
  ): Promise<boolean> {
    const [isAIsAdmin, isBIsAdmin] = await Promise.all([
      this.accessControlService.isAdmin(internalUserIdA),
      this.accessControlService.isAdmin(internalUserIdB),
    ]);
    return isAIsAdmin || isBIsAdmin;
  }

  private async assertNoExistingContact(
    requesterId: string,
    addresseeId: string,
  ): Promise<void> {
    const existing = await this.contactRepository.findOne({
      where: [
        { requesterId, addresseeId },
        { requesterId: addresseeId, addresseeId: requesterId },
      ],
    });
    if (existing) {
      throw new ContactAlreadyExistsException();
    }
  }

  /**
   * On a unique-violation (two requests racing past assertNoExistingContact's
   * pre-check, same shape as the race ChatService's findOrInsert* methods
   * already recover from): the other request already won, so this throws the
   * exact same exception the pre-check itself throws for the same outcome.
   */
  private async insertContact(
    requesterId: string,
    addresseeId: string,
  ): Promise<Contact> {
    try {
      return await this.contactRepository.save(
        this.contactRepository.create({
          requesterId,
          addresseeId,
          status: ContactStatus.PENDING,
        }),
      );
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) {
        throw error;
      }
      throw new ContactAlreadyExistsException();
    }
  }

  private async getContactOrThrow(contactId: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId },
    });
    if (!contact) {
      throw new ContactNotFoundException(contactId);
    }
    return contact;
  }

  private async getPendingRequestOrThrow(contactId: string): Promise<Contact> {
    const contact = await this.getContactOrThrow(contactId);
    if (contact.status !== ContactStatus.PENDING) {
      throw new ContactNotPendingException();
    }
    return contact;
  }

  /** Not found, not forbidden — a contact a user isn't party to shouldn't confirm its existence to them. */
  private assertIsAddressee(contact: Contact, actorId: string): void {
    if (contact.addresseeId !== actorId) {
      throw new ContactNotFoundException(contact.id);
    }
  }

  private assertIsParty(contact: Contact, actorId: string): void {
    const isParty =
      contact.requesterId === actorId || contact.addresseeId === actorId;
    if (!isParty) {
      throw new ContactNotFoundException(contact.id);
    }
  }

  private async getDtoOrThrow(contactId: string): Promise<ContactDto> {
    const contact = await this.contactRepository.findOneOrFail({
      where: { id: contactId },
      relations: RELATIONS,
    });
    return ContactFactory.toDto(contact);
  }
}
