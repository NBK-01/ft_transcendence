import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ShipmentState } from '../../shipments/constants/shipment-state';

/** A partner moves a shipment along; cancelling is DELETE instead. */
export const PARTNER_TRACKING_STATUSES = [
  ShipmentState.IN_TRANSIT,
  ShipmentState.OUT_FOR_DELIVERY,
  ShipmentState.DELIVERED,
] as const;
export type PartnerTrackingStatus = (typeof PARTNER_TRACKING_STATUSES)[number];

/** PUT /v1/shipments/:trackingId/status: the same moves an admin's tracking update allows. */
export class UpdatePartnerShipmentStatusDto {
  @ApiProperty({ enum: PARTNER_TRACKING_STATUSES })
  @IsIn(PARTNER_TRACKING_STATUSES)
  status!: PartnerTrackingStatus;

  @ApiProperty({ example: 'Lyon hub', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  location!: string;
}
