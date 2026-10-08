import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { OtpService } from '../otp/otp.service';
import { OtpPurpose } from '../otp/entities/otp-log.entity';
import { PasswordResetService } from './services/password-reset.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { CommunicationService } from '../communication/communication.service';
import { EmailTemplates } from '../common/templates/email-templates';
import { AuthContextService } from '../common/context';
import { JwtPayload } from './interfaces/jwt-payload.interface';
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
} from './exceptions/auth-exceptions';

const OTP_PREFIX = 'auth';

@Injectable()
export class AuthService {
  // This orchestrates auth end to end (register/login/OTP/refresh/password-reset) and
  // genuinely needs each of these collaborators — splitting it up would just move the
  // coupling, not remove it.
  // eslint-disable-next-line max-params
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly communicationService: CommunicationService,
    private readonly configService: ConfigService,
    private readonly authContext: AuthContextService,
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

  async verifyOtp(dto: VerifyOtpDto) {
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

    return this.issueTokens(user.id, user.email, {
      id: user.id,
      email: user.email,
      name: user.name,
      isVerified: true,
    });
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await this.usersService.comparePassword(
      dto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    if (!user.isVerified) {
      throw new AccountNotVerifiedException();
    }

    return this.issueTokens(user.id, user.email, {
      id: user.id,
      email: user.email,
      name: user.name,
    });
  }

  async refresh(refreshToken: string) {
    const { userId, newToken } =
      await this.refreshTokenService.rotate(refreshToken);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: newToken,
    };
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

    const hashedPassword = await this.usersService.hashPassword(
      dto.newPassword,
    );
    await this.usersService.updatePasswordHash(user.id, hashedPassword);
    await this.passwordResetService.invalidateToken(dto.token);
    await this.refreshTokenService.revokeAllForUser(user.id); // force re-login everywhere

    return { message: 'Password reset successfully' };
  }

  async changePassword(dto: ChangePasswordDto) {
    const contextUser = this.authContext.requireUser();
    const user = await this.usersService.findById(contextUser.id);
    if (!user) {
      throw new UserNotFoundException(contextUser.id);
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

  private async issueTokens(
    userId: string,
    email: string,
    userView: Record<string, unknown>,
  ) {
    const payload: JwtPayload = { sub: userId, email };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.refreshTokenService.issue(userId);
    return { accessToken, refreshToken, user: userView };
  }
}
