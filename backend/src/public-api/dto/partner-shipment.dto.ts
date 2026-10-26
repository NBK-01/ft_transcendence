import { ApiProperty } from '@nestjs/swagger';
import { ShipmentState } from '../../shipments/constants/shipment-state';
import { AddressDto } from '../../shipments/dto/address.dto';
import { ShipmentEventDto } from '../../shipments/dto/shipment.dto';

/**
 * Who it's for, as the partner knows them: only the email it sent. The
 * customer's id and name stay inside: a partner key reaches any customer by
 * email, so it shouldn't learn more about them than it already had.
 */
export class PartnerCustomerDto {
  @ApiProperty({ format: 'email', example: 'amina@example.com' })
  email!: string;
}

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
    type: PartnerCustomerDto,
    description: 'The customer it is for',
  })
  customer!: PartnerCustomerDto;

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
