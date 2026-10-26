import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { ListShipmentsQueryDto } from './list-shipments-query.dto';

/** GET /admin/shipments: the customer's filters, plus the branch. */
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
}
