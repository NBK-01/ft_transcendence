import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * New — the source template's forgotPassword() generates and emails a
 * reset token but has no corresponding endpoint to consume it. This DTO +
 * AuthService.resetPassword()/AuthController's `reset-password` route
 * close that loop.
 */
export class ResetPasswordDto {
  @ApiProperty({ description: 'Reset token from the password-reset email' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ example: 'NewSecurePass123', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
}
