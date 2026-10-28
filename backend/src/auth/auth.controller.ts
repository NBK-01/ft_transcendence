import {
  Controller,
  Post,
  Delete,
  Body,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TokenMetadata } from './services/refresh-token.service';
import { OAuthProfile } from './services/auth-provider-user.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { Public } from '../common/decorators/public.decorator';
import { RequireCustomer } from '../common/decorators/access-control.decorator';
import {
  GOOGLE_AUTH_FAILURE,
  GoogleAuthGuard,
  RequestWithGoogleFailure,
} from './guards/google-auth.guard';
import { AuthContextService } from '../common/context';
import { UsersService } from '../users/users.service';
import { DomainException } from '../common/exceptions/base/error-types';
import { AuthErrorCodes } from './exceptions/auth-exceptions';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authContext: AuthContextService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'Registered — verification code sent to email',
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.langFrom(req));
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and activate account' })
  @ApiResponse({ status: 200, description: 'Account activated, tokens issued' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  async verifyOtp(@Body() dto: VerifyOtpDto, @Req() req: Request) {
    return this.authService.verifyOtp(dto, this.metadataFrom(req));
  }

  @Public()
  @Post('resend-otp')
  @ApiOperation({ summary: 'Resend the account-verification OTP' })
  @ApiResponse({ status: 200, description: 'OTP resent' })
  async resendOtp(@Body() dto: ResendOtpDto, @Req() req: Request) {
    return this.authService.resendOtp(dto, this.langFrom(req));
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, this.metadataFrom(req));
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google')
  @ApiOperation({ summary: 'Redirect to Google for OAuth login' })
  googleLogin(): void {
    // GoogleAuthGuard itself performs the redirect — nothing to do here.
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get('google/callback')
  @ApiOperation({
    summary:
      'Google OAuth callback — redirects with a one-time code, or an error code if the guard or the callback itself failed',
  })
  async googleCallback(
    @Req() req: RequestWithGoogleFailure,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const redirectWithError = (error: unknown) => {
      const code =
        error instanceof DomainException
          ? error.code
          : AuthErrorCodes.GoogleAuthFailed;
      res.redirect(`${frontendUrl}/auth/oauth-callback?error=${code}`);
    };

    // The guard (GoogleAuthGuard.handleRequest) couldn't authenticate at all:
    // denied consent, an unverified email, or a provider error.
    const guardFailure = req[GOOGLE_AUTH_FAILURE];
    if (guardFailure !== undefined) {
      redirectWithError(guardFailure);
      return;
    }

    try {
      const profile = req.user as OAuthProfile;
      const code = await this.authService.handleGoogleCallback(profile);
      res.redirect(`${frontendUrl}/auth/oauth-callback?code=${code}`);
    } catch (error) {
      redirectWithError(error);
    }
  }

  @Public()
  @Post('oauth/exchange')
  @ApiOperation({
    summary:
      'Exchange a one-time OAuth code for an access + refresh token pair',
  })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid or expired code' })
  async exchangeOAuthCode(@Body() dto: OAuthExchangeDto, @Req() req: Request) {
    return this.authService.exchangeOAuthCode(dto.code, this.metadataFrom(req));
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary:
      'Exchange a refresh token for a new access + refresh token pair (rotates in place)',
  })
  @ApiResponse({ status: 200, description: 'New token pair issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    return this.authService.refresh(dto.refreshToken, this.metadataFrom(req));
  }

  @Public()
  @Post('logout')
  @ApiOperation({
    summary: 'Invalidate a single refresh token (this session only)',
  })
  @ApiResponse({ status: 200, description: 'Logged out' })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('logout-all')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Invalidate every refresh token for the authenticated user (logout everywhere)',
  })
  @ApiResponse({ status: 200, description: 'Logged out of all sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAll() {
    const user = this.authContext.requireUser();
    return this.authService.logoutAll(user.id);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Send a password reset link to the given email' })
  @ApiResponse({
    status: 200,
    description: 'Reset link sent if the email exists',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto, this.langFrom(req));
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({
    summary: 'Set a new password using a forgot-password reset token',
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for the authenticated user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(@Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser() {
    const user = this.authContext.requireUser();
    return this.usersService.getProfile(user.id);
  }

  // Lives here, not on UsersController: both end every session on the account
  // (RefreshTokenService), the same session-lifecycle concern as
  // change-password/logout-all above, and AuthService already holds that
  // collaborator — UsersModule doesn't import AuthModule, so it can't.
  //
  // Deactivate keeps the row (blocks login, history intact, reversible by
  // support); delete is the one that's actually gone. POST, not DELETE, for
  // deactivate — the HTTP verb matches what it does to the resource, not
  // just the button it's wired to in the client.
  @RequireCustomer()
  @Post('account/deactivate')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Deactivate the authenticated user's own account" })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deactivateAccount() {
    return this.authService.deactivateAccount();
  }

  @RequireCustomer()
  @Delete('account')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Permanently delete the authenticated user's own account and all owned data",
  })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAccount() {
    return this.authService.deleteAccount();
  }

  private metadataFrom(req: Request): TokenMetadata {
    return {
      deviceInfo: req.get('user-agent') ?? undefined,
      ipAddress: req.ip,
    };
  }

  /** Same source GlobalExceptionFilter reads for every other translated message — keep them in sync. */
  private langFrom(req: Request): string {
    return req.get('accept-language') ?? 'en';
  }
}
