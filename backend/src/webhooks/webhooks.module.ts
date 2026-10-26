import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentsModule } from '../shipments/shipments.module';
import { WebhookLog } from './entities/webhook-log.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { CarrierSignatureGuard } from './guards/carrier-signature.guard';

/**
 * Incoming webhooks (part of the Public API work): a carrier's signed
 * tracking updates. Each delivery is logged; QueuesModule processes them
 * (WebhookSignalsListener queues, CARRIER_WEBHOOK runs WebhooksService).
 */
@Module({
  imports: [TypeOrmModule.forFeature([WebhookLog]), ShipmentsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, CarrierSignatureGuard],
  exports: [WebhooksService],
})
export class WebhooksModule {}
