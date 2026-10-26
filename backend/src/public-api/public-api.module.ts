import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations/organization.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { PartnerController } from './partner.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyRateLimiterService } from './services/api-key-rate-limiter.service';
import { PartnerShipmentsController } from './partner-shipments.controller';
import { PartnerShipmentsService } from './partner-shipments.service';
import { ShipmentsModule } from '../shipments/shipments.module';
import { Shipment } from '../shipments/entities/shipment.entity';
import { User } from '../users/user.entity';

/**
 * The public API for partner systems: API keys (admin-managed, scoped to a
 * branch), and the /v1 routes partners call with one (ApiKeyGuard, a rate
 * limit per key): who's calling, and the branch's shipments. The webhooks
 * land here next.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      // Only read (the branch a new key is for), never written from here.
      Organization,
      // Partner shipments: created and listed here; status changes go
      // through ShipmentsService.transition.
      Shipment,
      // Only read (the customer a partner shipment is for).
      User,
    ]),
    ShipmentsModule,
  ],
  controllers: [
    ApiKeysController,
    PartnerController,
    PartnerShipmentsController,
  ],
  providers: [
    ApiKeysService,
    ApiKeyRateLimiterService,
    ApiKeyGuard,
    PartnerShipmentsService,
  ],
  exports: [ApiKeysService],
})
export class PublicApiModule {}
