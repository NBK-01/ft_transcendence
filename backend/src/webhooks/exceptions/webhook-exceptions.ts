import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

/**
 * In the third-party/webhooks range. 6001 and 6002 (a bad signature:
 * InvalidWebhookSignatureException) are in common/exceptions.
 */
export enum WebhookErrorCodes {
  WebhookNotConfigured = 6003,
  InvalidWebhookPayload = 6004,
}

export enum WebhookErrorMessages {
  WebhookNotConfigured = 'errors.WEBHOOK_NOT_CONFIGURED',
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

export class InvalidWebhookPayloadException extends DomainException {
  constructor(reason: string) {
    super(
      { key: WebhookErrorMessages.InvalidWebhookPayload, params: { reason } },
      HttpStatus.BAD_REQUEST,
      WebhookErrorCodes.InvalidWebhookPayload,
    );
  }
}
