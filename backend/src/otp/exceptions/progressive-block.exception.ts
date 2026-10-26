import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export interface ProgressiveBlockDetails {
  tier: number;
  waitTimeSeconds: number;
  nextAttemptAt: string;
  tierDescription: string;
  violatedLimit: number;
  violatedPeriod: number;
}

export class OtpProgressiveBlockException extends DomainException {
  constructor(details: ProgressiveBlockDetails) {
    super(
      { key: 'errors.OTP_PROGRESSIVE_BLOCK', params: { ...details } },
      HttpStatus.TOO_MANY_REQUESTS,
      15100, // reassigned from 4100 along with the rest of OTP's codes
    );
  }
}
