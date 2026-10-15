import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConfig } from '../../config/jwt.config';
import {
  AccessTokenPayload,
  TokenType,
} from '../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { InternalUsersService } from '../../internal-users/internal-users.service';
import { AuthContextService } from '../../common/context';
import {
  AccountType,
  RequestUser,
} from '../../common/context/auth-context.types';

/**
 * The one place that populates AuthContextService for a request — every
 * other service reads the user via `requireUser()`/`getUser()` instead of
 * re-fetching it.
 *
 * Only accepts `type: ACCESS` payloads — a refresh token is also a validly
 * signed JWT with the same secret, so without this check it could be used
 * directly as a Bearer token to hit any protected route.
 *
 * Branches on `accountType` to decide which table to look the subject up
 * in — one shared Passport strategy/guard for both customers and staff,
 * rather than duplicating the whole strategy/guard pair per population
 * (see jwt-payload.interface.ts's AccountType for why).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly internalUsersService: InternalUsersService,
    private readonly authContext: AuthContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig().secret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<RequestUser> {
    if (!payload.sub || payload.type !== TokenType.ACCESS) {
      throw new UnauthorizedException();
    }

    if (payload.accountType === AccountType.STAFF) {
      const staff = await this.internalUsersService.findById(payload.sub);
      if (!staff || !staff.isActive) {
        throw new UnauthorizedException();
      }
      const requestUser: RequestUser = {
        id: staff.id,
        email: staff.email,
        accountType: AccountType.STAFF,
      };
      this.authContext.set(requestUser);
      return requestUser;
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    const requestUser: RequestUser = {
      id: user.id,
      email: user.email,
      accountType: AccountType.CUSTOMER,
    };
    this.authContext.set(requestUser);
    return requestUser;
  }
}
