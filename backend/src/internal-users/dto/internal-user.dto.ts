import { ApiProperty } from '@nestjs/swagger';

export class InternalUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'email' })
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ nullable: true })
  roleName!: string | null;

  @ApiProperty({ nullable: true, format: 'uuid' })
  organizationId!: string | null;

  @ApiProperty({ type: Date })
  createdAt!: Date;

  @ApiProperty({ type: Date })
  updatedAt!: Date;
}
