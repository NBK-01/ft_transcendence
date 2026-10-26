import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

/** OTP domain error codes (15000-15999, reassigned from 4000-4999 — see error-types.ts) */
export enum OtpErrorCodes {
  OtpNotFound = 15001,
  OtpInvalid = 15003,
  OtpBlocked = 15005,
}

export enum OtpErrorMessages {
  OtpNotFound = 'errors.OTP_NOT_FOUND',
  OtpInvalid = 'errors.OTP_INVALID',
  OtpBlocked = 'errors.OTP_BLOCKED',
}

export class OtpNotFoundException extends DomainException {
  constructor(identifier: string) {
    super(
      { key: OtpErrorMessages.OtpNotFound, params: { identifier } },
      HttpStatus.NOT_FOUND,
      OtpErrorCodes.OtpNotFound,
    );
  }
}

export class OtpInvalidException extends DomainException {
  constructor() {
    super(
      { key: OtpErrorMessages.OtpInvalid },
      HttpStatus.UNAUTHORIZED,
      OtpErrorCodes.OtpInvalid,
    );
  }
}

export class OtpBlockedException extends DomainException {
  constructor(blockWindowSeconds: number) {
    super(
      { key: OtpErrorMessages.OtpBlocked, params: { blockWindowSeconds } },
      HttpStatus.TOO_MANY_REQUESTS,
      OtpErrorCodes.OtpBlocked,
    );
  }
}
