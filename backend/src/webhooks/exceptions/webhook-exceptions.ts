import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum WebhookErrorCodes {
  WebhookNotConfigured = 6001,
  InvalidWebhookSignature = 6002,
  InvalidWebhookPayload = 6003,
}

export enum WebhookErrorMessages {
  WebhookNotConfigured = 'errors.WEBHOOK_NOT_CONFIGURED',
  InvalidWebhookSignature = 'errors.WEBHOOK_INVALID_SIGNATURE',
  InvalidWebhookPayload = 'errors.WEBHOOK_INVALID_PAYLOAD',
}

/**
 * 503, not 404: the provider keeps retrying until the secret is set, instead
 * of giving up on events we'll want once it is.
 */
export class WebhookNotConfiguredException extends DomainException {
  constructor() {
    super(
      { key: WebhookErrorMessages.WebhookNotConfigured },
      HttpStatus.SERVICE_UNAVAILABLE,
      WebhookErrorCodes.WebhookNotConfigured,
    );
  }
}

/** Missing, malformed, too old or wrong: never says which. */
export class InvalidWebhookSignatureException extends DomainException {
  constructor() {
    super(
      { key: WebhookErrorMessages.InvalidWebhookSignature },
      HttpStatus.UNAUTHORIZED,
      WebhookErrorCodes.InvalidWebhookSignature,
    );
  }
}

export class InvalidWebhookPayloadException extends DomainException {
  constructor(reason: string) {
    super(
      { key: WebhookErrorMessages.InvalidWebhookPayload, params: { reason } },
      HttpStatus.BAD_REQUEST,
      WebhookErrorCodes.InvalidWebhookPayload,
    );
  }
}
