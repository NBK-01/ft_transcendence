import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** DELETE /v1/shipments/:trackingId: cancels it, keeping its history. */
export class CancelPartnerShipmentQueryDto {
  @ApiProperty({
    required: false,
    maxLength: 200,
    example: 'Customer refused the parcel',
    description:
      'Shown in the timeline. Without it: "Cancelled by <branch name>"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
