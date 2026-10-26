import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainException } from '../../common/exceptions/base/error-types';
import { WebhookErrorCodes } from '../exceptions';
import { computeSignature } from '../utils/signature';
import { CarrierSignatureGuard } from './carrier-signature.guard';

const SECRET = 'carrier-secret-for-tests';
const BODY = Buffer.from('{"eventId":"evt_1"}');

function check(
  secret: string | undefined,
  headers: Record<string, string>,
  rawBody: Buffer | undefined = BODY,
) {
  const guard = new CarrierSignatureGuard({
    get: () => secret,
  } as unknown as ConfigService);
  const context = {
    switchToHttp: () => ({ getRequest: () => ({ headers, rawBody }) }),
  } as unknown as ExecutionContext;
  try {
    return guard.canActivate(context);
  } catch (error) {
    const exception = error as DomainException;
    return { status: exception.getStatus(), code: exception.code };
  }
}

const now = () => Math.floor(Date.now() / 1000);
const header = (body = BODY) =>
  `t=${now()},v1=${computeSignature(SECRET, now(), body)}`;

describe('CarrierSignatureGuard', () => {
  it('lets a correctly signed delivery through', () => {
    expect(check(SECRET, { 'carrier-signature': header() })).toBe(true);
  });

  it('is a 503 (6001) while CARRIER_WEBHOOK_SECRET is unset, so the carrier retries later', () => {
    expect(check(undefined, { 'carrier-signature': header() })).toEqual({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      code: WebhookErrorCodes.WebhookNotConfigured,
    });
  });

  it('is a 401 (6002) without a header, with a bad one, or without the raw body', () => {
    const unauthorized = {
      status: HttpStatus.UNAUTHORIZED,
      code: WebhookErrorCodes.InvalidWebhookSignature,
    };
    expect(check(SECRET, {})).toEqual(unauthorized);
    expect(
      check(SECRET, { 'carrier-signature': header(Buffer.from('other')) }),
    ).toEqual(unauthorized);
    expect(check(SECRET, { 'carrier-signature': header() }, undefined)).toEqual(
      unauthorized,
    );
  });
});
