import { Module } from '@nestjs/common';
import { AccessControlModule } from '../access-control/access-control.module';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffAuthService } from './staff-auth.service';
import { StaffAuthController } from './staff-auth.controller';
import { InternalRefreshTokenService } from './services/internal-refresh-token.service';
import { InternalRefreshToken } from './entities/internal-refresh-token.entity';
import { jwtConfig } from '../config/jwt.config';
import { InternalUsersModule } from '../internal-users/internal-users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InternalRefreshToken]),
    // Own registration (same secret) — JwtModule isn't exported by AuthModule.
    JwtModule.register({
      secret: jwtConfig().secret,
      signOptions: { expiresIn: jwtConfig().accessTokenExpiresIn },
    }),
    InternalUsersModule,
    AccessControlModule,
  ],
  controllers: [StaffAuthController],
  providers: [StaffAuthService, InternalRefreshTokenService],
  exports: [StaffAuthService],
})
export class StaffAuthModule {}
