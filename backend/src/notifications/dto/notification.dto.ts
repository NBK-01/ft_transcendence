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
    description:
      'Depends on type. SHIPMENT_UPDATE: { trackingId, status } (status is a shipment status)',
  })
  payload!: NotificationPayload;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date, nullable: true })
  readAt!: Date | null;
}

export class NotificationCountDto {
  @ApiProperty({ example: 3 })
  count!: number;
}
