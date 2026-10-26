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

  @ApiProperty({
    description: 'Avatar URL, if one has been uploaded',
    nullable: true,
    required: false,
  })
  avatarUrl?: string | null;

  @ApiProperty({ description: 'Account creation timestamp', type: Date })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp', type: Date })
  updatedAt!: Date;

  @ApiProperty({ description: 'First name', nullable: true, required: false })
  firstName?: string | null;

  @ApiProperty({ description: 'Last name', nullable: true, required: false })
  lastName?: string | null;

  @ApiProperty({
    description: 'Calendar date, "YYYY-MM-DD" (no time, no time zone)',
    nullable: true,
    required: false,
  })
  dateOfBirth?: string | null;

  @ApiProperty({ description: 'Phone number', nullable: true, required: false })
  phoneNumber?: string | null;
}
