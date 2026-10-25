import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations/organization.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { PartnerController } from './partner.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeyRateLimiterService } from './services/api-key-rate-limiter.service';

/**
 * The public API for partner systems: API keys (admin-managed, scoped to a
 * branch), and the /v1 routes partners call with one (ApiKeyGuard, a rate
 * limit per key). The partner shipment endpoints and the webhooks land here next.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      // Only read (the branch a new key is for), never written from here.
      Organization,
    ]),
  ],
  controllers: [ApiKeysController, PartnerController],
  providers: [ApiKeysService, ApiKeyRateLimiterService, ApiKeyGuard],
  exports: [ApiKeysService],
})
export class PublicApiModule {}
