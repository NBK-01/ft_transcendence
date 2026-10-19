import { Injectable } from '@nestjs/common';
import { ContactsService } from '../contacts/contacts.service';
import { AccessControlService } from '../access-control/access-control.service';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { CHAT_SUPPORT_ACCESS_PERMISSION } from './chat.constants';
import {
  NotConversationParticipantException,
  StaffNotConnectedException,
} from './exceptions';

/**
 * The single place every "can this actor do X" question for chat is
 * answered — both the REST controller and the WebSocket gateway ask it the
 * same question, so the two transports can never enforce different rules.
 */
@Injectable()
export class ChatAccessService {
  constructor(
    private readonly contactsService: ContactsService,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** Gates read, join, and send alike — there's no separate read-only participant tier in this design. */
  async assertCanAccessConversation(
    actor: RequestUser,
    conversation: Conversation,
  ): Promise<void> {
    if (conversation.type === ConversationType.STAFF_DM) {
      return this.assertStaffDmAccess(actor, conversation);
    }
    return this.assertSupportConversationAccess(actor, conversation);
  }

  private async assertStaffDmAccess(
    actor: RequestUser,
    conversation: Conversation,
  ): Promise<void> {
    this.assertIsDmParticipant(actor, conversation);
    await this.assertStillConnected(conversation);
  }

  private assertIsDmParticipant(
    actor: RequestUser,
    conversation: Conversation,
  ): void {
    const isParticipant =
      actor.id === conversation.participantAId ||
      actor.id === conversation.participantBId;
    if (!isParticipant) {
      throw new NotConversationParticipantException();
    }
  }

  private async assertStillConnected(
    conversation: Conversation,
  ): Promise<void> {
    const connected = await this.contactsService.areConnected(
      conversation.participantAId as string,
      conversation.participantBId as string,
    );
    if (!connected) {
      throw new StaffNotConnectedException();
    }
  }

  private async assertSupportConversationAccess(
    actor: RequestUser,
    conversation: Conversation,
  ): Promise<void> {
    if (this.isOwningCustomer(actor, conversation)) {
      return;
    }
    if (await this.hasSupportAccess(actor)) {
      return;
    }
    throw new NotConversationParticipantException();
  }

  private isOwningCustomer(
    actor: RequestUser,
    conversation: Conversation,
  ): boolean {
    return (
      actor.accountType === AccountType.CUSTOMER &&
      actor.id === conversation.customerId
    );
  }

  private async hasSupportAccess(actor: RequestUser): Promise<boolean> {
    if (actor.accountType !== AccountType.STAFF) {
      return false;
    }
    return this.accessControlService.hasPermission(
      actor.id,
      CHAT_SUPPORT_ACCESS_PERMISSION,
    );
  }
}
