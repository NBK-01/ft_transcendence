import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO31661Alpha2,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/** Used both as input (admin confirms payment) and output (shipment detail). */
export class AddressDto {
  @ApiProperty({ example: 'Amina El Idrissi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: '18 Rue Oberkampf' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  street!: string;

  @ApiProperty({ example: 'Paris' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: '75011', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ example: 'FR', description: 'ISO 3166-1 alpha-2' })
  @IsISO31661Alpha2()
  country!: string;

  @ApiProperty({ example: '+961 70 123 456', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}
