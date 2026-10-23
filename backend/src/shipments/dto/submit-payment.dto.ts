import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** The card number and CVC are checked in the browser and never sent. */
export class PaymentCardDto {
  @ApiProperty({ example: 'Amina El Idrissi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  holderName!: string;

  @ApiProperty({ example: '4242' })
  @Matches(/^\d{4}$/)
  last4!: string;

  @ApiProperty({ example: 12, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  expMonth!: number;

  @ApiProperty({ example: 2030 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  expYear!: number;
}

export class SubmitPaymentDto {
  @ApiProperty({ example: 1, minimum: 1, maximum: 99 })
  @IsInt()
  @Min(1)
  @Max(99)
  quantity!: number;

  @ApiProperty({ type: PaymentCardDto })
  @ValidateNested()
  @Type(() => PaymentCardDto)
  card!: PaymentCardDto;
}
