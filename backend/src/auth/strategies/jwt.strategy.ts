import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConfig } from '../../config/jwt.config';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { UsersService } from '../../users/users.service';
import { AuthContextService } from '../../common/context';

/**
 * The one place that populates AuthContextService for a request — every
 * other service reads the user via `requireUser()`/`getUser()` instead of
 * re-fetching it.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly authContext: AuthContextService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig().secret,
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    this.authContext.set({ id: user.id, email: user.email });

    // Attached to request.user by Passport — kept minimal (not the full
    // entity/password hash) since this is what @CurrentUser() hands out.
    return { id: user.id, email: user.email };
  }
}
