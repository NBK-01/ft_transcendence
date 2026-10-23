import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsUrl, MaxLength } from 'class-validator';

/**
 * Multipart body of POST /shipments. Send a product link OR up to 5 photos
 * (field `images`), not both — the photos arrive through multer, not here.
 */
export class CreateShipmentDto {
  @ApiProperty({
    required: false,
    example: 'https://shop.example.com/products/wireless-earbuds',
  })
  // Multipart forms (Swagger included) send an empty field as "" — that means "no link", not a bad one.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && !value.trim() ? undefined : value,
  )
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  productUrl?: string;

  /**
   * Files arrive through multer, not here. This only tolerates the blank
   * text part Swagger UI (and some form libraries) send for an empty file
   * slot, which the global forbidNonWhitelisted would otherwise reject.
   */
  @ApiHideProperty()
  @IsOptional()
  images?: unknown;
}
