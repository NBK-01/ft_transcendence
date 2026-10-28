import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { googleOAuthConfig } from '../config/google-oauth.config';
import { PasswordResetService } from './services/password-reset.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { AuthProviderUserService } from './services/auth-provider-user.service';
import { OAuthCodeService } from './services/oauth-code.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthProviderUser } from './entities/auth-provider-user.entity';
import { jwtConfig } from '../config/jwt.config';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { InternalUsersModule } from '../internal-users/internal-users.module';
import { FileStorageModule } from '../file-storage/file-storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken, AuthProviderUser]),
    PassportModule,
    JwtModule.register({
      secret: jwtConfig().secret,
      signOptions: { expiresIn: jwtConfig().accessTokenExpiresIn },
    }),
    UsersModule,
    OtpModule,
    InternalUsersModule, // JwtStrategy resolves staff tokens via InternalUsersService
    FileStorageModule, // deleteAccount cleans up the avatar object
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    {
      // passport-google-oauth20's Strategy throws in its own constructor if
      // clientID/clientSecret are empty — only register it once they're real,
      // so a Docker/eval run with no Google credentials can still boot.
      // Nothing else injects GoogleStrategy directly, so `null` is harmless.
      provide: GoogleStrategy,
      useFactory: () => {
        const { clientId, clientSecret } = googleOAuthConfig();
        return clientId && clientSecret ? new GoogleStrategy() : null;
      },
    },
    PasswordResetService,
    RefreshTokenService,
    AuthProviderUserService,
    OAuthCodeService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
