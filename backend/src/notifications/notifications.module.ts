import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { InternalUser } from '../internal-users/internal-user.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ShipmentLookupService } from './shipment-lookup.service';

@Module({
  imports: [
    // ShipmentEvent and InternalUser are only read (ShipmentLookupService), never written.
    TypeOrmModule.forFeature([Notification, ShipmentEvent, InternalUser]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ShipmentLookupService],
  exports: [NotificationsService, ShipmentLookupService],
})
export class NotificationsModule {}
