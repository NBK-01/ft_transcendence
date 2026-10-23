import { Contact } from '../contact.entity';
import { ContactDto } from '../dto/contact.dto';

export class ContactFactory {
  static toDto(contact: Contact): ContactDto {
    return {
      id: contact.id,
      requesterId: contact.requesterId,
      requesterName: contact.requester.name,
      requesterEmail: contact.requester.email,
      addresseeId: contact.addresseeId,
      addresseeName: contact.addressee.name,
      addresseeEmail: contact.addressee.email,
      status: contact.status,
      createdAt: contact.createdAt,
      updatedAt: contact.updatedAt,
    };
  }

  static toDtoArray(contacts: Contact[]): ContactDto[] {
    return contacts.map((contact) => this.toDto(contact));
  }
}
