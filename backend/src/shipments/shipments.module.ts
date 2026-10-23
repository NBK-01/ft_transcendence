import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { Shipment } from './entities/shipment.entity';
import { ShipmentOffer } from './entities/shipment-offer.entity';
import { ShipmentFile } from './entities/shipment-file.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { ShipmentPayment } from './entities/shipment-payment.entity';
import { ShipmentsService } from './shipments.service';
import { AdminShipmentsService } from './admin-shipments.service';
import { ShipmentsController } from './shipments.controller';
import { AdminShipmentsController } from './admin-shipments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shipment,
      ShipmentOffer,
      ShipmentFile,
      ShipmentEvent,
      ShipmentPayment,
    ]),
    FileStorageModule,
  ],
  controllers: [ShipmentsController, AdminShipmentsController],
  providers: [ShipmentsService, AdminShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
