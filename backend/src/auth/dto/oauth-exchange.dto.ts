import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthExchangeDto {
  @ApiProperty({
    description: 'One-time code from the OAuth callback redirect',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
