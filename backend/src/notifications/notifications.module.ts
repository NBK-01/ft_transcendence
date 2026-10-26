import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { InternalUser } from '../internal-users/internal-user.entity';
import { Organization } from '../organizations/organization.entity';
import { Contact } from '../contacts/contact.entity';
import { User } from '../users/user.entity';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { ShipmentLookupService } from './shipment-lookup.service';
import { ActionLookupService } from './action-lookup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      // Only read (the lookup services), never written from here.
      ShipmentEvent,
      Shipment,
      InternalUser,
      Organization,
      Contact,
      User,
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, ShipmentLookupService, ActionLookupService],
  exports: [NotificationsService, ShipmentLookupService, ActionLookupService],
})
export class NotificationsModule {}
