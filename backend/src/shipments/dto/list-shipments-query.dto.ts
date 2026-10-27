import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ShipmentState } from '../constants/shipment-state';

/** Columns GET /admin/shipments can sort by, matching the admin board's own columns. */
export enum ShipmentSortField {
  TRACKING_ID = 'trackingId',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListShipmentsQueryDto {
  @ApiProperty({ required: false, default: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ required: false, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiProperty({
    required: false,
    description: 'Tracking ID search (partial, case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  q?: string;

  @ApiProperty({ required: false, enum: ShipmentState })
  @IsOptional()
  @IsEnum(ShipmentState)
  status?: ShipmentState;
}
