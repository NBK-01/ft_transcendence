import { Controller, Post, Body, Req } from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { StaffAuthService } from './staff-auth.service';
import { TokenMetadata } from './services/internal-refresh-token.service';
import { StaffLoginDto } from './dto/staff-login.dto';
import { StaffRefreshTokenDto } from './dto/staff-refresh-token.dto';
import { StaffChangePasswordDto } from './dto/staff-change-password.dto';
import { Public, RequireStaff } from '../common/decorators';
import { AuthContextService } from '../common/context';

/**
 * Staff-only auth surface — no register/verify-otp/resend-otp/forgot-password:
 * staff accounts are provisioned (and reset) by an admin via InternalUsersController,
 * not self-service.
 */
@ApiTags('Staff Authentication')
@Controller('staff-auth')
export class StaffAuthController {
  constructor(
    private readonly staffAuthService: StaffAuthService,
    private readonly authContext: AuthContextService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Staff login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or inactive account',
  })
  async login(@Body() dto: StaffLoginDto, @Req() req: Request) {
    return this.staffAuthService.login(dto, this.metadataFrom(req));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary:
      'Exchange a refresh token for a new access + refresh token pair (rotates in place)',
  })
  @ApiResponse({ status: 200, description: 'New token pair issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: StaffRefreshTokenDto, @Req() req: Request) {
    return this.staffAuthService.refresh(
      dto.refreshToken,
      this.metadataFrom(req),
    );
  }

  @Public()
  @Post('logout')
  @ApiOperation({
    summary: 'Invalidate a single refresh token (this session only)',
  })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Body() dto: StaffRefreshTokenDto) {
    return this.staffAuthService.logout(dto.refreshToken);
  }

  @RequireStaff()
  @Post('logout-all')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Invalidate every refresh token for the authenticated staff member',
  })
  @ApiResponse({ status: 200, description: 'Logged out of all sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAll() {
    const user = this.authContext.requireUser();
    return this.staffAuthService.logoutAll(user.id);
  }

  @RequireStaff()
  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password for the authenticated staff member',
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(@Body() dto: StaffChangePasswordDto) {
    return this.staffAuthService.changePassword(dto);
  }

  private metadataFrom(req: Request): TokenMetadata {
    return {
      deviceInfo: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    };
  }
}
