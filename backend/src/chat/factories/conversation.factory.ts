import { Conversation } from '../entities/conversation.entity';
import { ConversationDto } from '../dto/conversation.dto';

export class ConversationFactory {
  static toDto(conversation: Conversation): ConversationDto {
    return {
      id: conversation.id,
      type: conversation.type,
      customerId: conversation.customerId ?? null,
      participantAId: conversation.participantAId ?? null,
      participantBId: conversation.participantBId ?? null,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  static toDtoArray(conversations: Conversation[]): ConversationDto[] {
    return conversations.map((conversation) => this.toDto(conversation));
  }
}
