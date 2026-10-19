import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ListMessagesQueryDto } from './dto/list-messages-query.dto';
import {
  RequireCustomer,
  RequireStaff,
} from '../common/decorators/access-control.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @RequireCustomer()
  @Post('support')
  @ApiOperation({
    summary: 'Open (or fetch) the standing support conversation',
  })
  async openSupportConversation(@CurrentUser() currentUser: RequestUser) {
    return this.chatService.getOrCreateSupportConversation(currentUser.id);
  }

  @RequireStaff()
  @Post('conversations/with/:internalUserId')
  @ApiOperation({ summary: 'Open (or fetch) a DM with a connected contact' })
  @ApiResponse({ status: 403, description: 'Not a connected contact' })
  async openStaffDm(
    @Param('internalUserId', ParseUUIDPipe) internalUserId: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.chatService.getOrCreateStaffDm(currentUser.id, internalUserId);
  }

  // Intentionally undecorated below — both customers and staff legitimately
  // call these, and ChatService/ChatAccessService branch on accountType
  // themselves. Not a missed @RequireStaff()/@RequireCustomer().

  @Get('conversations')
  @ApiOperation({ summary: 'List my conversations' })
  async listConversations(@CurrentUser() currentUser: RequestUser) {
    return this.chatService.listConversations(currentUser);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'List messages in a conversation' })
  async listMessages(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Query() query: ListMessagesQueryDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.chatService.listMessages(
      currentUser,
      conversationId,
      query.page,
      query.limit,
    );
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message' })
  @ApiResponse({
    status: 403,
    description: 'Not authorized for this conversation',
  })
  async sendMessage(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.chatService.sendMessage(
      currentUser,
      conversationId,
      dto.content,
    );
  }

  @Patch('conversations/:id/read')
  @ApiOperation({ summary: 'Mark a conversation as read' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    await this.chatService.markConversationAsRead(currentUser, conversationId);
    return { message: 'Conversation marked as read' };
  }
}
