import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

// 2001 is MissingAuthContextException, in common/exceptions/auth-exceptions.ts — keep numbering
// contiguous across both files, this is still the single "Auth domain" 2000-2999 range.
export enum AuthErrorCodes {
  InvalidCredentials = 2002,
  InvalidRefreshToken = 2003,
  InvalidResetToken = 2004,
  AccountNotVerified = 2005,
}

export enum AuthErrorMessages {
  InvalidCredentials = 'errors.INVALID_CREDENTIALS',
  InvalidRefreshToken = 'errors.INVALID_REFRESH_TOKEN',
  InvalidResetToken = 'errors.INVALID_RESET_TOKEN',
  AccountNotVerified = 'errors.ACCOUNT_NOT_VERIFIED',
}

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.InvalidCredentials },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.InvalidCredentials,
    );
  }
}

export class InvalidRefreshTokenException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.InvalidRefreshToken },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.InvalidRefreshToken,
    );
  }
}

export class InvalidResetTokenException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.InvalidResetToken },
      HttpStatus.BAD_REQUEST,
      AuthErrorCodes.InvalidResetToken,
    );
  }
}

export class AccountNotVerifiedException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.AccountNotVerified },
      HttpStatus.FORBIDDEN,
      AuthErrorCodes.AccountNotVerified,
    );
  }
}
