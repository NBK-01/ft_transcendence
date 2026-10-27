import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  ListShipmentsQueryDto,
  ShipmentSortField,
  SortOrder,
} from './list-shipments-query.dto';

/** GET /admin/shipments: the customer's filters, plus the branch and sorting. */
export class ListAdminShipmentsQueryDto extends ListShipmentsQueryDto {
  @ApiProperty({
    required: false,
    format: 'uuid',
    description:
      "Only this branch's shipments. Customer requests have no branch, so they never match",
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiProperty({
    required: false,
    enum: ShipmentSortField,
    default: ShipmentSortField.UPDATED_AT,
  })
  @IsOptional()
  @IsEnum(ShipmentSortField)
  sort?: ShipmentSortField;

  @ApiProperty({ required: false, enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
