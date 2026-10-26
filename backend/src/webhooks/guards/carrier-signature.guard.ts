import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CARRIER_SIGNATURE_HEADER } from '../constants/webhook.constants';
import {
  InvalidWebhookSignatureException,
  WebhookNotConfiguredException,
} from '../exceptions';
import { checkSignature } from '../utils/signature';

/**
 * The carrier webhook's door: a valid Carrier-Signature over the raw body
 * (main.ts creates the app with rawBody: true). Without CARRIER_WEBHOOK_SECRET
 * every delivery gets a 503, so the carrier retries until it's configured.
 */
@Injectable()
export class CarrierSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // Read on each request, so setting the secret doesn't need a restart.
    const secret = this.configService.get<string>('CARRIER_WEBHOOK_SECRET');
    if (!secret) {
      throw new WebhookNotConfiguredException();
    }
    const request = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();
    const header = request.headers[CARRIER_SIGNATURE_HEADER];
    const result = checkSignature(
      Array.isArray(header) ? header[0] : header,
      request.rawBody ?? Buffer.alloc(0),
      secret,
    );
    if (result !== 'valid') {
      throw new InvalidWebhookSignatureException();
    }
    return true;
  }
}
