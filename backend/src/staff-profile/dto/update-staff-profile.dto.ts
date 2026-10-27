import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** PATCH /staff-profile: what a staff member may change about themselves. Email, role and branch stay an admin's. */
export class UpdateStaffProfileDto {
  @ApiProperty({ example: 'Rami Khoury', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;
}
