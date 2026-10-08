import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

/** OTP domain error codes (4000-4999) */
export enum OtpErrorCodes {
  OtpNotFound = 4001,
  OtpInvalid = 4003,
  OtpBlocked = 4005,
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
