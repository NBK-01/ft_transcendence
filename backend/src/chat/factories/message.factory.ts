import { Message } from '../entities/message.entity';
import { MessageDto } from '../dto/message.dto';

export class MessageFactory {
  static toDto(message: Message): MessageDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      senderType: message.senderType,
      content: message.content,
      createdAt: message.createdAt,
    };
  }

  static toDtoArray(messages: Message[]): MessageDto[] {
    return messages.map((message) => this.toDto(message));
  }
}
