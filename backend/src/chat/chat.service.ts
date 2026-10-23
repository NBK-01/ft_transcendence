import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, ConversationType } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Message } from './entities/message.entity';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { ChatAccessService } from './chat-access.service';
import { ContactsService } from '../contacts/contacts.service';
import { AccessControlService } from '../access-control/access-control.service';
import { ConversationDto } from './dto/conversation.dto';
import { MessageDto } from './dto/message.dto';
import { ConversationFactory } from './factories/conversation.factory';
import { MessageFactory } from './factories/message.factory';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CHAT_SUPPORT_ACCESS_PERMISSION } from './chat.constants';
import {
  ConversationNotFoundException,
  StaffNotConnectedException,
} from './exceptions';

const POSTGRES_UNIQUE_VIOLATION = '23505';
const PARTICIPANT_CONFLICT_KEYS = [
  'conversationId',
  'participantId',
  'participantType',
] as const;

@Injectable()
export class ChatService {
  // Orchestrates persistence across three tables plus two cross-cutting collaborators
  // (authorization, contact-connection checks) — splitting further would just move the
  // coupling, not remove it, matching this codebase's existing AuthService precedent.
  // eslint-disable-next-line max-params
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepository: Repository<ConversationParticipant>,
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    private readonly chatAccessService: ChatAccessService,
    private readonly contactsService: ContactsService,
    private readonly accessControlService: AccessControlService,
  ) {}

  /**
   * The one shared "am I allowed into this conversation at all" gate — also
   * used by ChatGateway's joinConversation handler, so a WebSocket room join
   * and a REST read/send enforce the identical rule.
   */
  async getAuthorizedConversation(
    actor: RequestUser,
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.chatAccessService.assertCanAccessConversation(
      actor,
      conversation,
    );
    return conversation;
  }

  async sendMessage(
    actor: RequestUser,
    conversationId: string,
    content: string,
  ): Promise<MessageDto> {
    const conversation = await this.getConversationOrThrow(conversationId);
    await this.chatAccessService.assertCanSendMessage(actor, conversation);
    const message = await this.createMessage(conversation.id, actor, content);
    await this.markConversationAsRead(actor, conversation.id);
    return MessageFactory.toDto(message);
  }

  async listMessages(
    actor: RequestUser,
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    await this.getAuthorizedConversation(actor, conversationId);
    const [messages, totalItems] = await this.messageRepository.findAndCount({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return PaginatedResponseDto.create(
      MessageFactory.toDtoArray(messages),
      totalItems,
      page,
      limit,
    );
  }

  async markConversationAsRead(
    actor: RequestUser,
    conversationId: string,
  ): Promise<void> {
    await this.getAuthorizedConversation(actor, conversationId);
    await this.upsertParticipantReadState(actor, conversationId);
  }

  private async upsertParticipantReadState(
    actor: RequestUser,
    conversationId: string,
  ): Promise<void> {
    await this.participantRepository.upsert(
      {
        conversationId,
        participantId: actor.id,
        participantType: actor.accountType,
        lastReadAt: new Date(),
      },
      [...PARTICIPANT_CONFLICT_KEYS],
    );
  }

  async getOrCreateStaffDm(
    actorId: string,
    otherInternalUserId: string,
  ): Promise<ConversationDto> {
    await this.assertCanOpenStaffDm(actorId, otherInternalUserId);
    const [participantAId, participantBId] = this.sortParticipantPair(
      actorId,
      otherInternalUserId,
    );
    const conversation = await this.findOrInsertStaffDm(
      participantAId,
      participantBId,
    );
    await this.ensureDmParticipantsExist(
      conversation.id,
      participantAId,
      participantBId,
    );
    return ConversationFactory.toDto(conversation);
  }

  async getOrCreateSupportConversation(
    customerId: string,
  ): Promise<ConversationDto> {
    const conversation = await this.findOrInsertSupportConversation(customerId);
    await this.ensureSupportParticipantExists(conversation.id, customerId);
    return ConversationFactory.toDto(conversation);
  }

  async listConversations(actor: RequestUser): Promise<ConversationDto[]> {
    if (actor.accountType === AccountType.CUSTOMER) {
      return this.listCustomerConversations(actor.id);
    }
    return this.listStaffConversations(actor.id);
  }

  private async listCustomerConversations(
    customerId: string,
  ): Promise<ConversationDto[]> {
    const conversation = await this.conversationRepository.findOne({
      where: { type: ConversationType.SUPPORT, customerId },
    });
    return conversation ? [ConversationFactory.toDto(conversation)] : [];
  }

  private async listStaffConversations(
    internalUserId: string,
  ): Promise<ConversationDto[]> {
    const [dms, supportConversations] = await Promise.all([
      this.findStaffDmConversations(internalUserId),
      this.findSupportConversationsIfAuthorized(internalUserId),
    ]);
    return ConversationFactory.toDtoArray([...dms, ...supportConversations]);
  }

  private findStaffDmConversations(
    internalUserId: string,
  ): Promise<Conversation[]> {
    return this.conversationRepository.find({
      where: [
        { type: ConversationType.STAFF_DM, participantAId: internalUserId },
        { type: ConversationType.STAFF_DM, participantBId: internalUserId },
      ],
    });
  }

  private async findSupportConversationsIfAuthorized(
    internalUserId: string,
  ): Promise<Conversation[]> {
    const authorized = await this.accessControlService.hasPermission(
      internalUserId,
      CHAT_SUPPORT_ACCESS_PERMISSION,
    );
    if (!authorized) {
      return [];
    }
    return this.conversationRepository.find({
      where: { type: ConversationType.SUPPORT },
    });
  }

  private async getConversationOrThrow(
    conversationId: string,
  ): Promise<Conversation> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new ConversationNotFoundException(conversationId);
    }
    return conversation;
  }

  private createMessage(
    conversationId: string,
    actor: RequestUser,
    content: string,
  ): Promise<Message> {
    return this.messageRepository.save(
      this.messageRepository.create({
        conversationId,
        senderId: actor.id,
        senderType: actor.accountType,
        content,
      }),
    );
  }

  private async assertCanOpenStaffDm(
    actorId: string,
    otherInternalUserId: string,
  ): Promise<void> {
    const connected = await this.contactsService.areConnected(
      actorId,
      otherInternalUserId,
    );
    if (!connected) {
      throw new StaffNotConnectedException();
    }
  }

  /** The one place pair-ordering logic exists, so it can't drift between read and write paths. */
  private sortParticipantPair(idA: string, idB: string): [string, string] {
    return idA < idB ? [idA, idB] : [idB, idA];
  }

  /** On a unique-violation (the race from the Conversation entity), re-selects the row the other concurrent request just won. */
  private async findOrInsertStaffDm(
    participantAId: string,
    participantBId: string,
  ): Promise<Conversation> {
    try {
      return await this.conversationRepository.save(
        this.conversationRepository.create({
          type: ConversationType.STAFF_DM,
          participantAId,
          participantBId,
        }),
      );
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }
      return this.conversationRepository.findOneByOrFail({
        participantAId,
        participantBId,
      });
    }
  }

  private async ensureDmParticipantsExist(
    conversationId: string,
    participantAId: string,
    participantBId: string,
  ): Promise<void> {
    await this.participantRepository.upsert(
      [
        {
          conversationId,
          participantId: participantAId,
          participantType: AccountType.STAFF,
        },
        {
          conversationId,
          participantId: participantBId,
          participantType: AccountType.STAFF,
        },
      ],
      [...PARTICIPANT_CONFLICT_KEYS],
    );
  }

  private async findOrInsertSupportConversation(
    customerId: string,
  ): Promise<Conversation> {
    try {
      return await this.conversationRepository.save(
        this.conversationRepository.create({
          type: ConversationType.SUPPORT,
          customerId,
        }),
      );
    } catch (error) {
      if (!this.isUniqueConstraintViolation(error)) {
        throw error;
      }
      return this.conversationRepository.findOneByOrFail({ customerId });
    }
  }

  private async ensureSupportParticipantExists(
    conversationId: string,
    customerId: string,
  ): Promise<void> {
    await this.participantRepository.upsert(
      {
        conversationId,
        participantId: customerId,
        participantType: AccountType.CUSTOMER,
      },
      [...PARTICIPANT_CONFLICT_KEYS],
    );
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION;
  }
}
