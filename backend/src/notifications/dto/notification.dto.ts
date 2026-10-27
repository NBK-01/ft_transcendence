import { ApiProperty } from '@nestjs/swagger';
import {
  NotificationPayload,
  NotificationStatus,
  NotificationType,
} from '../constants/notification.constants';

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiProperty({ enum: NotificationStatus })
  status!: NotificationStatus;

  @ApiProperty({
    example: 'Out for delivery',
    description: 'English. Frontends word it themselves from type + payload',
  })
  title!: string;

  @ApiProperty({ example: 'TRK-4A6F90 is out for delivery.' })
  message!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { trackingId: 'TRK-4A6F90', status: 'out_for_delivery' },
    description: [
      'Depends on type (see NotificationPayloads).',
      'SHIPMENT_UPDATE: { trackingId, status, isNew?, actorType? }.',
      'BRANCH_*: { organizationId, name }; BRANCH_STAFF_* add staffName.',
      'STAFF_ACCOUNT_CREATED / _DEACTIVATED: { internalUserId, name };',
      'STAFF_ACCOUNT_UPDATED adds { changed, roleName, organizationId, organizationName }.',
      'CONTACT_REQUEST_*: { contactId, internalUserId, name } (the other person).',
      'SUPPORT_CONVERSATION_STARTED: { conversationId, customerName }.',
      'SHIPMENT_FILE_ADDED: { trackingId, kind, fileName }.',
      'SHIPMENT_BRANCH_ASSIGNED: { trackingId, organizationId, branchName } (null when taken off a branch).',
      'PASSWORD_CHANGED: {}.',
      'API_KEY_*: { apiKeyId, name, organizationId, branchName, maskedKey }.',
      'CUSTOMER_REGISTERED / CUSTOMER_ACCOUNT_DEACTIVATED: { customerId, name }.',
      "PROFILE_UPDATED: { change: 'details' | 'avatar' }. SESSIONS_REVOKED: {}.",
      'CONTACT_REQUEST_DECLINED / _CANCELLED, CONTACT_REMOVED, CONTACT_BLOCKED: as CONTACT_REQUEST_*.',
      'CONVERSATION_STARTED: { conversationId, internalUserId, name } (the other person).',
      'MESSAGE_RECEIVED: { conversationId, conversationType, senderName }.',
    ].join(' '),
  })
  payload!: NotificationPayload;

  @ApiProperty({
    description:
      'The reader is the one who acted: a record of their own action ("You created…"), not news.',
  })
  ownAction!: boolean;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  readAt!: Date | null;
}

export class NotificationCountDto {
  @ApiProperty({ example: 3 })
  count!: number;
}
