import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccountType } from '../common/context/auth-context.types';
import { ActionSignals } from '../notifications/action-signals';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { AuthProvider } from '../users/user.entity';
import { OtpService } from '../otp/otp.service';
import { OtpPurpose } from '../otp/entities/otp-log.entity';
import { PasswordResetService } from './services/password-reset.service';
import {
  RefreshTokenService,
  TokenMetadata,
  TokenPair,
} from './services/refresh-token.service';
import {
  AuthProviderUserService,
  OAuthProfile,
} from './services/auth-provider-user.service';
import { OAuthCodeService } from './services/oauth-code.service';
import { CommunicationService } from '../communication/communication.service';
import { EmailTemplates } from '../common/templates/email-templates';
import { AuthContextService } from '../common/context';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  UserAlreadyExistsException,
  UserNotFoundException,
} from '../users/exceptions';
import {
  InvalidCredentialsException,
  InvalidResetTokenException,
  AccountNotVerifiedException,
  AccountDeactivatedException,
  InvalidRefreshTokenException,
  OAuthAccountConflictException,
  OAuthCodeInvalidException,
  WrongAuthProviderException,
} from './exceptions/auth-exceptions';

const OTP_PREFIX = 'auth';

@Injectable()
export class AuthService {
  // This orchestrates auth end to end (register/login/OTP/refresh/password-reset/OAuth) and
  // genuinely needs each of these collaborators — splitting it up would just move the
  // coupling, not remove it.
  // eslint-disable-next-line max-params
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly authProviderUserService: AuthProviderUserService,
    private readonly oauthCodeService: OAuthCodeService,
    private readonly communicationService: CommunicationService,
    private readonly configService: ConfigService,
    private readonly authContext: AuthContextService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);

    if (existingUser?.isVerified) {
      throw new UserAlreadyExistsException(dto.email);
    }

    // An existing-but-unverified record means a prior registration never completed OTP
    // verification — re-send the code for that same pending record rather than trying to
    // INSERT a second row with the same email (which the unique constraint would reject).
    const user = existingUser ?? (await this.usersService.create(dto));

    await this.otpService.requestOtp(
      dto.email,
      OTP_PREFIX,
      OtpPurpose.ACCOUNT_VERIFICATION,
    );

    return {
      message:
        'Registration successful. Please check your email for the verification code.',
      email: user.email,
    };
  }

  async resendOtp(dto: ResendOtpDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UserNotFoundException(dto.email);
    }
    if (user.isVerified) {
      throw new BadRequestException('User is already verified');
    }

    await this.otpService.requestOtp(
      dto.email,
      OTP_PREFIX,
      OtpPurpose.ACCOUNT_VERIFICATION,
    );
    return {
      message: 'Verification code resent. Please check your email.',
      email: user.email,
    };
  }

  async verifyOtp(dto: VerifyOtpDto, metadata?: TokenMetadata) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UserNotFoundException(dto.email);
    }

    const isDevBypass =
      this.configService.get('NODE_ENV') === 'development' &&
      dto.otp === '123456';
    if (!isDevBypass) {
      await this.otpService.verifyOtp(dto.email, dto.otp, OTP_PREFIX, user.id);
    }

    await this.usersService.verifyUser(user.id);
    user.isVerified = true;

    const tokens = await this.refreshTokenService.generateTokenPair(
      user,
      metadata,
    );
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: true,
      },
    };
  }

  async login(dto: LoginDto, metadata?: TokenMetadata) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }
    if (!user.password) {
      throw new WrongAuthProviderException(user.authProvider);
    }

    const isPasswordValid = await this.usersService.comparePassword(
      dto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    if (!user.isActive) {
      throw new AccountDeactivatedException();
    }

    if (!user.isVerified) {
      throw new AccountNotVerifiedException();
    }

    const tokens = await this.refreshTokenService.generateTokenPair(
      user,
      metadata,
    );
    return {
      ...tokens,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  /** Decodes (unverified) just to find which user to load — validateRefreshToken() does the real signature/hash verification below. */
  async refresh(
    rawToken: string,
    metadata?: TokenMetadata,
  ): Promise<TokenPair> {
    const userId = this.peekSubjectUnverified(rawToken);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new InvalidRefreshTokenException();
    }

    const tokenRecord = await this.refreshTokenService.validateRefreshToken(
      rawToken,
      user,
    );
    return this.refreshTokenService.rotateRefreshToken(
      tokenRecord,
      user,
      metadata,
    );
  }

  /** Logout — invalidate just this session. Fails open on a malformed/already-invalid token: logging out never needs to error. */
  async logout(rawToken: string): Promise<{ message: string }> {
    try {
      const userId = this.peekSubjectUnverified(rawToken);
      const user = await this.usersService.findById(userId);
      if (user) {
        const tokenRecord = await this.refreshTokenService.validateRefreshToken(
          rawToken,
          user,
        );
        await this.refreshTokenService.deleteToken(tokenRecord.id);
      }
    } catch {
      // already invalid/expired — nothing to do
    }
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    const count = await this.refreshTokenService.deleteAllUserTokens(userId);
    this.eventEmitter.emit(ActionSignals.SESSIONS_REVOKED, {
      accountType: AccountType.CUSTOMER,
      accountId: userId,
    });
    return { message: `Logged out of ${count} session(s)` };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      // Don't reveal whether the email exists.
      return {
        message: 'If the email exists, a password reset link has been sent.',
      };
    }

    const resetToken = await this.passwordResetService.generateResetToken(
      dto.email,
    );
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:5173',
    );
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    const { subject, html } = EmailTemplates.passwordReset(
      resetUrl,
      resetToken,
      this.passwordResetService.getTokenExpiryMinutes(),
    );
    await this.communicationService.sendEmail(dto.email, subject, html);

    return {
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const email = await this.passwordResetService.verifyResetToken(dto.token);
    if (!email) {
      throw new InvalidResetTokenException();
    }

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UserNotFoundException(email);
    }
    if (user.authProvider !== AuthProvider.EMAIL) {
      throw new WrongAuthProviderException(user.authProvider);
    }

    const hashedPassword = await this.usersService.hashPassword(
      dto.newPassword,
    );
    await this.usersService.updatePasswordHash(user.id, hashedPassword);
    await this.passwordResetService.invalidateToken(dto.token);
    await this.refreshTokenService.deleteAllUserTokens(user.id); // force re-login everywhere

    return { message: 'Password reset successfully' };
  }

  async changePassword(dto: ChangePasswordDto) {
    const contextUser = this.authContext.requireUser();
    const user = await this.usersService.findById(contextUser.id);
    if (!user) {
      throw new UserNotFoundException(contextUser.id);
    }
    if (!user.password) {
      throw new WrongAuthProviderException(user.authProvider);
    }

    const isCurrentValid = await this.usersService.comparePassword(
      dto.currentPassword,
      user.password,
    );
    if (!isCurrentValid) {
      throw new InvalidCredentialsException();
    }

    const hashedPassword = await this.usersService.hashPassword(
      dto.newPassword,
    );
    await this.usersService.updatePasswordHash(user.id, hashedPassword);
    return { message: 'Password changed successfully' };
  }

  /** Self-deactivation: blocks future login and kills every existing session. */
  async deactivateAccount(): Promise<{ message: string }> {
    const contextUser = this.authContext.requireUser();
    await this.usersService.deactivate(contextUser.id);
    await this.refreshTokenService.deleteAllUserTokens(contextUser.id);
    return { message: 'Account deactivated' };
  }

  /**
   * Finds-or-creates the user for a verified Google profile, then returns a
   * short-lived one-time code (not tokens) — see exchangeOAuthCode. Called
   * from the /auth/google/callback route after GoogleAuthGuard runs.
   */
  async handleGoogleCallback(profile: OAuthProfile): Promise<string> {
    const user = await this.findOrCreateOAuthUser(profile);
    return this.oauthCodeService.generateCode(user.id);
  }

  async exchangeOAuthCode(code: string, metadata?: TokenMetadata) {
    const userId = await this.oauthCodeService.consumeCode(code);
    if (!userId) {
      throw new OAuthCodeInvalidException();
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }
    if (!user.isActive) {
      throw new AccountDeactivatedException();
    }

    const tokens = await this.refreshTokenService.generateTokenPair(
      user,
      metadata,
    );
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isVerified: user.isVerified,
      },
    };
  }

  private async findOrCreateOAuthUser(profile: OAuthProfile) {
    const link = await this.authProviderUserService.findByProvider(
      AuthProvider.GOOGLE,
      profile.providerId,
    );
    if (link) {
      await this.authProviderUserService.updateProfile(link.id, profile);
      const user = await this.usersService.findById(link.userId);
      if (!user) {
        throw new UserNotFoundException(link.userId);
      }
      return user;
    }

    const existing = await this.usersService.findByEmail(profile.email);
    if (existing) {
      // Hard block, no silent auto-linking — the person must use their original sign-in method.
      throw new OAuthAccountConflictException(profile.email);
    }

    const user = await this.usersService.createOAuthUser(profile);
    await this.authProviderUserService.create(
      user.id,
      AuthProvider.GOOGLE,
      profile,
    );
    return user;
  }

  /** Reads `sub` off the JWT half without checking its signature — never trust this alone, see refresh()/logout(). */
  private peekSubjectUnverified(rawToken: string): string {
    const jwtPart = rawToken.split('.').slice(0, 3).join('.');
    const decoded = this.jwtService.decode(jwtPart) as { sub?: string } | null;
    if (!decoded?.sub) {
      throw new InvalidRefreshTokenException();
    }
    return decoded.sub;
  }
}
