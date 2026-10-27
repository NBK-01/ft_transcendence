import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AccountType } from '../common/context/auth-context.types';
import { ActionSignals } from '../notifications/action-signals';
import { InternalUsersService } from '../internal-users/internal-users.service';
import {
  InternalRefreshTokenService,
  TokenMetadata,
  TokenPair,
} from './services/internal-refresh-token.service';
import { AuthContextService } from '../common/context';
import { StaffLoginDto } from './dto/staff-login.dto';
import { StaffChangePasswordDto } from './dto/staff-change-password.dto';
import { StaffMeDto } from './dto/staff-me.dto';
import { AccessControlService } from '../access-control/access-control.service';
import { InternalUserNotFoundException } from '../internal-users/exceptions';
import {
  InvalidStaffCredentialsException,
  InvalidStaffRefreshTokenException,
} from './exceptions';
import { InternalUserInactiveException } from '../access-control/exceptions';

@Injectable()
export class StaffAuthService {
  // eslint-disable-next-line max-params
  constructor(
    private readonly jwtService: JwtService,
    private readonly internalUsersService: InternalUsersService,
    private readonly internalRefreshTokenService: InternalRefreshTokenService,
    private readonly authContext: AuthContextService,
    private readonly eventEmitter: EventEmitter2,
    private readonly accessControlService: AccessControlService,
  ) {}

  /** The signed-in staff member as they are now: a rename, a new role or branch shows without signing in again. */
  async me(): Promise<StaffMeDto> {
    const { id } = this.authContext.requireUser();
    const [staff, permissions] = await Promise.all([
      this.internalUsersService.findWithBranch(id),
      this.accessControlService.getEffectivePermissions(id),
    ]);
    if (!staff) {
      throw new InternalUserNotFoundException(id);
    }
    const { organization } = staff;
    return {
      id: staff.id,
      email: staff.email,
      name: staff.name,
      roleName: staff.role?.name ?? null,
      organizationId: staff.organizationId,
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            isActive: organization.isActive,
          }
        : null,
      permissions,
    };
  }

  async login(dto: StaffLoginDto, metadata?: TokenMetadata) {
    const staff = await this.internalUsersService.findByEmail(dto.email);
    if (!staff) {
      throw new InvalidStaffCredentialsException();
    }

    const isPasswordValid = await this.internalUsersService.comparePassword(
      dto.password,
      staff.password,
    );
    if (!isPasswordValid) {
      throw new InvalidStaffCredentialsException();
    }

    if (!staff.isActive) {
      throw new InternalUserInactiveException();
    }

    const tokens = await this.internalRefreshTokenService.generateTokenPair(
      staff,
      metadata,
    );
    return {
      ...tokens,
      user: {
        id: staff.id,
        email: staff.email,
        name: staff.name,
        roleName: staff.role?.name ?? null,
      },
    };
  }

  async refresh(
    rawToken: string,
    metadata?: TokenMetadata,
  ): Promise<TokenPair> {
    const userId = this.peekSubjectUnverified(rawToken);
    const staff = await this.internalUsersService.findById(userId);
    if (!staff) {
      throw new InvalidStaffRefreshTokenException();
    }

    const tokenRecord =
      await this.internalRefreshTokenService.validateRefreshToken(
        rawToken,
        staff,
      );
    return this.internalRefreshTokenService.rotateRefreshToken(
      tokenRecord,
      staff,
      metadata,
    );
  }

  async logout(rawToken: string): Promise<{ message: string }> {
    try {
      const userId = this.peekSubjectUnverified(rawToken);
      const staff = await this.internalUsersService.findById(userId);
      if (staff) {
        const tokenRecord =
          await this.internalRefreshTokenService.validateRefreshToken(
            rawToken,
            staff,
          );
        await this.internalRefreshTokenService.deleteToken(tokenRecord.id);
      }
    } catch {
      // already invalid/expired — nothing to do
    }
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string): Promise<{ message: string }> {
    const count =
      await this.internalRefreshTokenService.deleteAllUserTokens(userId);
    this.eventEmitter.emit(ActionSignals.SESSIONS_REVOKED, {
      accountType: AccountType.STAFF,
      accountId: userId,
    });
    return { message: `Logged out of ${count} session(s)` };
  }

  async changePassword(dto: StaffChangePasswordDto) {
    const contextUser = this.authContext.requireUser();
    const staff = await this.internalUsersService.findById(contextUser.id);
    if (!staff) {
      throw new InternalUserNotFoundException(contextUser.id);
    }

    const isCurrentValid = await this.internalUsersService.comparePassword(
      dto.currentPassword,
      staff.password,
    );
    if (!isCurrentValid) {
      throw new InvalidStaffCredentialsException();
    }

    const hashedPassword = await this.internalUsersService.hashPassword(
      dto.newPassword,
    );
    await this.internalUsersService.updatePasswordHash(
      staff.id,
      hashedPassword,
    );
    return { message: 'Password changed successfully' };
  }

  /** Reads `sub` off the JWT half without checking its signature — never trust this alone, see refresh()/logout(). */
  private peekSubjectUnverified(rawToken: string): string {
    const jwtPart = rawToken.split('.').slice(0, 3).join('.');
    const decoded = this.jwtService.decode(jwtPart) as { sub?: string } | null;
    if (!decoded?.sub) {
      throw new InvalidStaffRefreshTokenException();
    }
    return decoded.sub;
  }
}
