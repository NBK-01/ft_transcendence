import { Shipment } from '../../shipments/entities/shipment.entity';
import { User } from '../../users/user.entity';
import { ShipmentEventDto } from '../../shipments/dto/shipment.dto';
import {
  PartnerShipmentDetailDto,
  PartnerShipmentDto,
} from '../dto/partner-shipment.dto';

/** A shipment loaded with its customer, as PartnerShipmentsService always loads it. */
export type ShipmentWithClient = Shipment & { client: User };

export class PartnerShipmentFactory {
  static toDto(shipment: ShipmentWithClient): PartnerShipmentDto {
    return {
      trackingId: shipment.trackingId,
      status: shipment.status,
      origin: shipment.origin,
      destination: shipment.destination,
      customer: { email: shipment.client.email },
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }

  static toDetail(
    shipment: ShipmentWithClient,
    events: ShipmentEventDto[],
  ): PartnerShipmentDetailDto {
    return {
      ...this.toDto(shipment),
      sender: shipment.sender,
      recipient: shipment.recipient,
      weightKg: shipment.weightKg,
      events,
    };
  }
}
