import { ApiProperty } from '@nestjs/swagger';

export class StaffBranchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;
}

/** GET /staff-auth/me: the signed-in staff member as they are now, with what they may do. */
export class StaffMeDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'dispatcher' })
  roleName!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  organizationId!: string | null;

  @ApiProperty({ type: StaffBranchDto, nullable: true })
  organization!: StaffBranchDto | null;

  @ApiProperty({
    type: [String],
    example: ['shipments:read:org', 'shipments:update:org'],
    description: "The role's permissions (an admin passes every check anyway)",
  })
  permissions!: string[];
}
