import { ApiProperty } from '@nestjs/swagger';
import { ShipmentState } from '../../shipments/constants/shipment-state';
import { AddressDto } from '../../shipments/dto/address.dto';
import {
  ShipmentClientDto,
  ShipmentEventDto,
} from '../../shipments/dto/shipment.dto';

/** A row of GET /v1/shipments: one of the key's branch's shipments. */
export class PartnerShipmentDto {
  @ApiProperty({ example: 'TRK-4A6F90' })
  trackingId!: string;

  @ApiProperty({ enum: ShipmentState })
  status!: ShipmentState;

  @ApiProperty({ type: String, nullable: true, example: 'Lyon' })
  origin!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Paris' })
  destination!: string | null;

  @ApiProperty({
    type: ShipmentClientDto,
    description: 'The customer it is for',
  })
  customer!: ShipmentClientDto;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;
}

/** GET /v1/shipments/:trackingId, and what every change returns. */
export class PartnerShipmentDetailDto extends PartnerShipmentDto {
  @ApiProperty({ type: AddressDto, nullable: true })
  sender!: AddressDto | null;

  @ApiProperty({ type: AddressDto, nullable: true })
  recipient!: AddressDto | null;

  @ApiProperty({ type: Number, nullable: true, example: 1.5 })
  weightKg!: number | null;

  @ApiProperty({
    type: [ShipmentEventDto],
    description: 'The timeline, newest first',
  })
  events!: ShipmentEventDto[];
}
