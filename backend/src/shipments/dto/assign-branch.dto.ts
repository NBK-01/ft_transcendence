import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, ValidateIf } from 'class-validator';

/** PATCH /admin/shipments/:trackingId/branch. */
export class AssignBranchDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The branch to hand the order to, or null to take it off any branch',
  })
  @ValidateIf((dto: AssignBranchDto) => dto.organizationId !== null)
  @IsUUID()
  organizationId!: string | null;
}
