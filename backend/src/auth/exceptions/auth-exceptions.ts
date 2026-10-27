import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

// 2001 is MissingAuthContextException, in common/exceptions/auth-exceptions.ts — keep numbering
// contiguous across both files, this is still the single "Auth domain" 2000-2999 range.
export enum AuthErrorCodes {
  InvalidCredentials = 2002,
  InvalidRefreshToken = 2003,
  InvalidResetToken = 2004,
  AccountNotVerified = 2005,
  RefreshTokenExpired = 2006,
  SessionInvalidated = 2007,
  OAuthAccountConflict = 2008,
  WrongAuthProvider = 2009,
  OAuthCodeInvalid = 2010,
  GoogleEmailNotVerified = 2011,
  AccountDeactivated = 2012,
  GoogleAuthFailed = 2013,
}

export enum AuthErrorMessages {
  InvalidCredentials = 'errors.INVALID_CREDENTIALS',
  InvalidRefreshToken = 'errors.INVALID_REFRESH_TOKEN',
  InvalidResetToken = 'errors.INVALID_RESET_TOKEN',
  AccountNotVerified = 'errors.ACCOUNT_NOT_VERIFIED',
  RefreshTokenExpired = 'errors.REFRESH_TOKEN_EXPIRED',
  SessionInvalidated = 'errors.SESSION_INVALIDATED',
  OAuthAccountConflict = 'errors.OAUTH_ACCOUNT_CONFLICT',
  WrongAuthProvider = 'errors.WRONG_AUTH_PROVIDER',
  OAuthCodeInvalid = 'errors.OAUTH_CODE_INVALID',
  GoogleEmailNotVerified = 'errors.GOOGLE_EMAIL_NOT_VERIFIED',
  AccountDeactivated = 'errors.ACCOUNT_DEACTIVATED',
  GoogleAuthFailed = 'errors.GOOGLE_AUTH_FAILED',
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

export class RefreshTokenExpiredException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.RefreshTokenExpired },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.RefreshTokenExpired,
    );
  }
}

/** Thrown when a refresh token is otherwise valid but predates the user's forceLogoutAfter timestamp. */
export class SessionInvalidatedException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.SessionInvalidated },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.SessionInvalidated,
    );
  }
}

/** A password-based account already exists with this email — no silent auto-linking to an OAuth login. */
export class OAuthAccountConflictException extends DomainException {
  constructor(email: string) {
    super(
      { key: AuthErrorMessages.OAuthAccountConflict, params: { email } },
      HttpStatus.CONFLICT,
      AuthErrorCodes.OAuthAccountConflict,
    );
  }
}

/** Thrown on password login/change against an account whose authProvider isn't EMAIL. */
export class WrongAuthProviderException extends DomainException {
  constructor(provider: string) {
    super(
      { key: AuthErrorMessages.WrongAuthProvider, params: { provider } },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.WrongAuthProvider,
    );
  }
}

/** The OAuth exchange code is missing, expired, or already consumed. */
export class OAuthCodeInvalidException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.OAuthCodeInvalid },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.OAuthCodeInvalid,
    );
  }
}

export class GoogleEmailNotVerifiedException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.GoogleEmailNotVerified },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.GoogleEmailNotVerified,
    );
  }
}

/** Thrown at login once a customer has deactivated their own account (DELETE /users/profile). */
export class AccountDeactivatedException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.AccountDeactivated },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.AccountDeactivated,
    );
  }
}

/** The Google round-trip itself failed: the user denied consent, or the provider errored — never a domain-specific reason. */
export class GoogleAuthFailedException extends DomainException {
  constructor() {
    super(
      { key: AuthErrorMessages.GoogleAuthFailed },
      HttpStatus.UNAUTHORIZED,
      AuthErrorCodes.GoogleAuthFailed,
    );
  }
}
