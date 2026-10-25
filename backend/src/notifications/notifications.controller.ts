import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';
import { NotificationsService } from './notifications.service';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationCountDto, NotificationDto } from './dto/notification.dto';

/**
 * The caller's own notifications. Intentionally undecorated: customers and
 * staff both call these, and every query is scoped to the token's
 * (id, accountType) — not a missed @RequireStaff()/@RequireCustomer().
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List my notifications, newest first (dismissed ones excluded)',
  })
  @ApiResponse({
    status: 200,
    type: [NotificationDto],
    description: 'data: one page of notifications, meta: pagination',
  })
  async list(
    @CurrentUser() currentUser: RequestUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.list(currentUser, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'How many of my notifications are unread' })
  @ApiResponse({ status: 200, type: NotificationCountDto })
  async unreadCount(@CurrentUser() currentUser: RequestUser) {
    return this.notificationsService.unreadCount(currentUser);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all my notifications as read' })
  @ApiResponse({
    status: 200,
    type: NotificationCountDto,
    description: 'How many were marked',
  })
  async markAllAsRead(@CurrentUser() currentUser: RequestUser) {
    return this.notificationsService.markAllRead(currentUser);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiResponse({ status: 200, type: NotificationDto })
  @ApiResponse({
    status: 404,
    description: "Not found, dismissed, or not the caller's",
  })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    return this.notificationsService.markRead(currentUser, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Dismiss a notification (it leaves the list and the counts)',
  })
  @ApiResponse({
    status: 404,
    description: "Not found, already dismissed, or not the caller's",
  })
  async dismiss(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: RequestUser,
  ) {
    await this.notificationsService.dismiss(currentUser, id);
    return { message: 'Notification dismissed' };
  }
}
