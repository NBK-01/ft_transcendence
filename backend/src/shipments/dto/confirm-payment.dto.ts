import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Max, Min, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';

/** What the admin fills in when confirming a payment: the shipment goes live with this route. */
export class ConfirmPaymentDto {
  @ApiProperty({ type: AddressDto, description: 'Usually the supplier' })
  @ValidateNested()
  @Type(() => AddressDto)
  sender!: AddressDto;

  @ApiProperty({ type: AddressDto, description: 'Usually the client' })
  @ValidateNested()
  @Type(() => AddressDto)
  recipient!: AddressDto;

  @ApiProperty({ example: 1.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  weightKg!: number;
}
