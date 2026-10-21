import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { jwtConfig } from '../config/jwt.config';
import {
  AccessTokenPayload,
  JwtPayload,
  TokenType,
} from '../auth/interfaces/jwt-payload.interface';
import { AccountType, RequestUser } from '../common/context/auth-context.types';
import { UsersService } from '../users/users.service';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { WsAuthenticationException } from './exceptions';

/**
 * Authenticates a Socket.IO handshake the same way JwtStrategy authenticates
 * an HTTP request — verified independently here because WebSocket handlers
 * never pass through JwtAuthGuard/JwtStrategy at all.
 */
@Injectable()
export class ConnectionAuthenticator {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly internalUsersService: InternalUsersService,
  ) {}

  async authenticate(client: Socket): Promise<RequestUser> {
    const payload = await this.verifyAccessToken(client);
    return this.resolveRequestUser(payload);
  }

  /**
   * Re-checked periodically on an already-open connection (see ChatGateway) —
   * mirrors exactly what JwtStrategy.validate() re-checks per HTTP request
   * for staff (isActive), nothing more: forceLogoutAfter only gates the
   * refresh-token flow, an access token is otherwise valid until it expires.
   */
  async isStillValid(user: RequestUser): Promise<boolean> {
    if (user.accountType !== AccountType.STAFF) {
      return true;
    }
    const staff = await this.internalUsersService.findById(user.id);
    return staff?.isActive ?? false;
  }

  private async verifyAccessToken(client: Socket): Promise<AccessTokenPayload> {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      throw new WsAuthenticationException();
    }
    const payload = await this.decodeAndVerify(token);
    if (payload.type !== TokenType.ACCESS) {
      throw new WsAuthenticationException();
    }
    return payload;
  }

  private async decodeAndVerify(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtConfig().secret,
      });
    } catch {
      throw new WsAuthenticationException();
    }
  }

  private resolveRequestUser(
    payload: AccessTokenPayload,
  ): Promise<RequestUser> {
    if (payload.accountType === AccountType.STAFF) {
      return this.resolveStaffUser(payload.sub);
    }
    return this.resolveCustomerUser(payload.sub);
  }

  private async resolveStaffUser(internalUserId: string): Promise<RequestUser> {
    const staff = await this.internalUsersService.findById(internalUserId);
    if (!staff?.isActive) {
      throw new WsAuthenticationException();
    }
    return {
      id: staff.id,
      email: staff.email,
      accountType: AccountType.STAFF,
    };
  }

  private async resolveCustomerUser(userId: string): Promise<RequestUser> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new WsAuthenticationException();
    }
    return {
      id: user.id,
      email: user.email,
      accountType: AccountType.CUSTOMER,
    };
  }
}
