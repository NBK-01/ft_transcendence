import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InternalUser } from '../internal-users/internal-user.entity';
import { ApiKey } from '../public-api/entities/api-key.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { User } from '../users/user.entity';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

/**
 * GET /admin/stats/overview: the admin overview's shipment numbers. Only
 * reads: shipments and their events to count, and the customers, staff and
 * API keys behind each event to name who did it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shipment,
      ShipmentEvent,
      User,
      InternalUser,
      ApiKey,
    ]),
  ],
  controllers: [StatsController],
  providers: [StatsService],
})
export class StatsModule {}
