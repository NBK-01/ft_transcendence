import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNumber,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { AddressDto } from '../../shipments/dto/address.dto';

/**
 * POST /v1/shipments: a shipment the partner's branch already has in hand,
 * so it starts at `confirmed` (no sourcing, no payment), for a customer who
 * already has an account.
 */
export class CreatePartnerShipmentDto {
  @ApiProperty({
    format: 'email',
    example: 'amina@example.com',
    description:
      "The customer's account email: the shipment appears in their account",
  })
  @IsEmail()
  @MaxLength(254)
  customerEmail!: string;

  // IsDefined: ValidateNested alone lets a missing object through.
  @ApiProperty({ type: AddressDto, description: 'Usually the branch' })
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  sender!: AddressDto;

  @ApiProperty({ type: AddressDto, description: 'Usually the customer' })
  @IsDefined()
  @ValidateNested()
  @Type(() => AddressDto)
  recipient!: AddressDto;

  @ApiProperty({ example: 1.5, minimum: 0.01, maximum: 100_000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100_000)
  weightKg!: number;
}
