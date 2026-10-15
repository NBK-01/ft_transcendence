import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum StaffAuthErrorCodes {
  InvalidCredentials = 8003,
  InvalidRefreshToken = 8004,
  RefreshTokenExpired = 8005,
  SessionInvalidated = 8006,
}

// Reuses the same i18n message keys as customer auth (identical user-facing text) —
// distinct numeric codes so a client can still tell "customer login failed" (2002) apart
// from "staff login failed" (8003) by error code alone.
export enum StaffAuthErrorMessages {
  InvalidCredentials = 'errors.INVALID_CREDENTIALS',
  InvalidRefreshToken = 'errors.INVALID_REFRESH_TOKEN',
  RefreshTokenExpired = 'errors.REFRESH_TOKEN_EXPIRED',
  SessionInvalidated = 'errors.SESSION_INVALIDATED',
}

export class InvalidStaffCredentialsException extends DomainException {
  constructor() {
    super(
      { key: StaffAuthErrorMessages.InvalidCredentials },
      HttpStatus.UNAUTHORIZED,
      StaffAuthErrorCodes.InvalidCredentials,
    );
  }
}

export class InvalidStaffRefreshTokenException extends DomainException {
  constructor() {
    super(
      { key: StaffAuthErrorMessages.InvalidRefreshToken },
      HttpStatus.UNAUTHORIZED,
      StaffAuthErrorCodes.InvalidRefreshToken,
    );
  }
}

export class StaffRefreshTokenExpiredException extends DomainException {
  constructor() {
    super(
      { key: StaffAuthErrorMessages.RefreshTokenExpired },
      HttpStatus.UNAUTHORIZED,
      StaffAuthErrorCodes.RefreshTokenExpired,
    );
  }
}

export class StaffSessionInvalidatedException extends DomainException {
  constructor() {
    super(
      { key: StaffAuthErrorMessages.SessionInvalidated },
      HttpStatus.UNAUTHORIZED,
      StaffAuthErrorCodes.SessionInvalidated,
    );
  }
}
