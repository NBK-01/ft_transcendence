import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PasswordResetService } from './services/password-reset.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { jwtConfig } from '../config/jwt.config';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { InternalUsersModule } from '../internal-users/internal-users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RefreshToken]),
    PassportModule,
    JwtModule.register({
      secret: jwtConfig().secret,
      signOptions: { expiresIn: jwtConfig().accessTokenExpiresIn },
    }),
    UsersModule,
    OtpModule,
    InternalUsersModule, // JwtStrategy resolves staff tokens via InternalUsersService
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    PasswordResetService,
    RefreshTokenService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
