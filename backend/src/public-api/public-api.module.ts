import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organizations/organization.entity';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';

/**
 * The public API for partner systems: API keys (admin-managed, scoped to a
 * branch). The key guard, the partner endpoints and the webhooks land here
 * next.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKey,
      // Only read (the branch a new key is for), never written from here.
      Organization,
    ]),
  ],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class PublicApiModule {}
