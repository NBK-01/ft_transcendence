import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StaffRefreshTokenDto {
  @ApiProperty({ description: 'Refresh token issued at staff login' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}
