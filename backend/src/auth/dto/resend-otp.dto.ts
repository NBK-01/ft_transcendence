import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({ example: 'user@example.com', format: 'email' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
