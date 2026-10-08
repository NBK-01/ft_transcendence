import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base/error-types';

export enum AuthErrorCodes {
  MissingAuthContext = 2001,
}

export enum AuthErrorMessages {
  MissingAuthContext = 'errors.MISSING_AUTH_CONTEXT',
}

/**
 * Thrown by AuthContextService.requireUser() when called outside an
 * authenticated request (e.g. a bug in a guard/route wiring, not a normal
 * "user isn't logged in" case — that's handled by JwtAuthGuard itself).
 */
export class MissingAuthContextException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.MissingAuthContext },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.MissingAuthContext,
    );
  }
}
