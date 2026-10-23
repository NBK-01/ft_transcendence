import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ShipmentState } from '../constants/shipment-state';

const TRACKING_EVENT_STATUSES = [
  ShipmentState.IN_TRANSIT,
  ShipmentState.OUT_FOR_DELIVERY,
  ShipmentState.DELIVERED,
  ShipmentState.CANCELLED,
] as const;

/** A tracking update: moves the shipment to `status` and adds a timeline step. */
export class CreateEventDto {
  @ApiProperty({ enum: TRACKING_EVENT_STATUSES })
  @IsIn(TRACKING_EVENT_STATUSES)
  status!: (typeof TRACKING_EVENT_STATUSES)[number];

  @ApiProperty({ example: 'Lyon hub' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location!: string;
}
