import { ApiProperty } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty({
    description: 'User ID (UUID)',
    example: '550e8400-e29b-41d4-a716-446655440000',
    format: 'uuid',
  })
  id!: string;

  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com',
    format: 'email',
  })
  email!: string;

  @ApiProperty({ description: 'Full name', example: 'John Doe' })
  name!: string;

  @ApiProperty({
    description: 'Whether the account has completed OTP verification',
    example: false,
  })
  isVerified!: boolean;

  @ApiProperty({ description: 'Account creation timestamp', type: Date })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: Date })
  updatedAt!: Date;
}
