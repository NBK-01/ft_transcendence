import { ApiProperty } from '@nestjs/swagger';

export class StaffProfileBranchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

/** GET /staff-profile/:id: a colleague, as any staff member may see them. */
export class StaffProfileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ type: String, nullable: true, example: 'dispatcher' })
  roleName!: string | null;

  @ApiProperty({ type: StaffProfileBranchDto, nullable: true })
  organization!: StaffProfileBranchDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'A signed URL; null shows their initials',
  })
  avatarUrl!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ type: Date })
  createdAt!: Date;
}
