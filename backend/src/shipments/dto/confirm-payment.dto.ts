import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsNumber, Max, Min, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto';

/** What the admin fills in when confirming a payment: the shipment goes live with this route. */
export class ConfirmPaymentDto {
  // IsDefined: ValidateNested alone lets a missing object through, and the
  // service then fails on it with a 500 instead of a 400.
  @ApiProperty({ type: AddressDto, description: 'Usually the supplier' })
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  sender!: AddressDto;

  @ApiProperty({ type: AddressDto, description: 'Usually the client' })
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  recipient!: AddressDto;

  @ApiProperty({ example: 1.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  weightKg!: number;
}
