import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInternalUserDto {
  @ApiProperty({ example: 'staff@example.com', format: 'email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'SecurePass123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Jane Dispatcher' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Role name, e.g. admin/dispatcher/driver/support',
    example: 'dispatcher',
  })
  @IsString()
  @IsNotEmpty()
  roleName!: string;

  @ApiProperty({
    description: 'Organization (branch) to assign, if any',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
