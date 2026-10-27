import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatAccessService } from './chat-access.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ConnectionAuthenticator } from './connection-authenticator';
import { PresenceModule } from './presence.module';
import { WsExceptionFilter } from './ws-exception.filter';
import { Conversation } from './entities/conversation.entity';
import { ConversationParticipant } from './entities/conversation-participant.entity';
import { Message } from './entities/message.entity';
import { ContactsModule } from '../contacts/contacts.module';
import { AccessControlModule } from '../access-control/access-control.module';
import { UsersModule } from '../users/users.module';
import { InternalUsersModule } from '../internal-users/internal-users.module';
import { jwtConfig } from '../config/jwt.config';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationParticipant, Message]),
    ContactsModule,
    PresenceModule,
    AccessControlModule,
    UsersModule,
    InternalUsersModule,
    JwtModule.register({
      secret: jwtConfig().secret,
      signOptions: { expiresIn: jwtConfig().accessTokenExpiresIn },
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatAccessService,
    ChatGateway,
    ConnectionAuthenticator,
    WsExceptionFilter,
  ],
  exports: [ChatService, ChatAccessService],
})
export class ChatModule {}
