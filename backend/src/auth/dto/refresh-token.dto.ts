import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token issued at login/register/verify-otp',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
