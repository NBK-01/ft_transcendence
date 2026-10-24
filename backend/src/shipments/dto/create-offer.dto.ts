import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Multipart body of POST /admin/shipments/:trackingId/offer, with up to 5
 * supplier photos in the `images` field. Numbers arrive as strings in
 * multipart and are converted by the global ValidationPipe.
 */
export class CreateOfferDto {
  @ApiProperty({ example: 'Shenzhen Gadget Co.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  supplierName!: string;

  @ApiProperty({ example: 24.9, description: 'Price of one unit' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(1_000_000)
  unitPrice!: number;

  @ApiProperty({ example: 'USD', description: 'ISO 4217' })
  @IsISO4217CurrencyCode()
  currency!: string;

  @ApiProperty({
    required: false,
    example: 'In stock. Ships within 3 days of payment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /**
   * Files arrive through multer, not here. This only tolerates the blank
   * text part Swagger UI (and some form libraries) send for an empty file
   * slot, which the global forbidNonWhitelisted would otherwise reject.
   */
  @ApiHideProperty()
  @IsOptional()
  images?: unknown;
}
