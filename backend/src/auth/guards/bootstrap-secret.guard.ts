import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';

/**
 * Validates the `x-bootstrap-secret` header against ADMIN_BOOTSTRAP_SECRET
 * using a constant-time comparison. An empty/unset secret disables the path
 * entirely — every request is then rejected.
 */
@Injectable()
export class BootstrapSecretGuard implements CanActivate {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>('ADMIN_BOOTSTRAP_SECRET', '');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!this.isValid(request.headers['x-bootstrap-secret'])) {
      throw new UnauthorizedException();
    }
    return true;
  }

  isValid(provided: unknown): boolean {
    if (
      this.secret.length === 0 ||
      typeof provided !== 'string' ||
      provided.length === 0
    ) {
      return false;
    }

    const providedBuffer = Buffer.from(provided, 'utf8');
    const secretBuffer = Buffer.from(this.secret, 'utf8');

    // Length check first: timingSafeEqual throws on differing lengths.
    if (providedBuffer.length !== secretBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, secretBuffer);
  }
}
