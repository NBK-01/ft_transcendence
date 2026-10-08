import { HttpStatus } from '@nestjs/common';
import { DomainException } from './base/error-types';

export enum ThirdPartyErrorCodes {
  ThirdPartyServiceError = 6001,
  InvalidWebhookSignature = 6002,
}

export enum ThirdPartyErrorMessages {
  ThirdPartyServiceError = 'errors.THIRD_PARTY_SERVICE_ERROR',
  InvalidWebhookSignature = 'errors.INVALID_WEBHOOK_SIGNATURE',
}

export class ThirdPartyServiceException extends DomainException {
  constructor(service: string) {
    super(
      {
        key: ThirdPartyErrorMessages.ThirdPartyServiceError,
        params: { service },
      },
      HttpStatus.BAD_GATEWAY,
      ThirdPartyErrorCodes.ThirdPartyServiceError,
    );
  }
}

export class InvalidWebhookSignatureException extends DomainException {
  constructor(provider: string) {
    super(
      {
        key: ThirdPartyErrorMessages.InvalidWebhookSignature,
        params: { provider },
      },
      HttpStatus.UNAUTHORIZED,
      ThirdPartyErrorCodes.InvalidWebhookSignature,
    );
  }
}
