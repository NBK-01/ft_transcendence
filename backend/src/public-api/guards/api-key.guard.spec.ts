import { ExecutionContext, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClsService } from 'nestjs-cls';
import { ApiKeyGuard } from './api-key.guard';
import {
  ApiKeyPrincipal,
  ApiKeysService,
  ApiKeyVerification,
} from '../api-keys.service';
import {
  ApiKeyRateLimiterService,
  RateLimitState,
} from '../services/api-key-rate-limiter.service';
import {
  ApiKeyRejection,
  PARTNER_CONTEXT_KEY,
} from '../constants/api-key.constants';
import { PublicApiErrorCodes } from '../exceptions';
import { DomainException } from '../../common/exceptions/base/error-types';
import { PartnerRequest } from '../types/partner-context';

const KEY = `stk_${'a'.repeat(64)}`;
const INTERNAL_CALLER_KEY = 'internal-secret-for-tests';
const NOW = 1_700_000_000_000;

const principal: ApiKeyPrincipal = {
  id: 'key-1',
  name: 'Carrier sync',
  organizationId: 'org-1',
  organizationName: 'Lyon',
};

const underLimit: RateLimitState = {
  limit: 60,
  remaining: 59,
  resetAt: NOW + 30_000,
  exceeded: false,
};

function setup({
  verification = { valid: true, apiKey: principal },
  rateLimit = underLimit,
  internalCallerKey = INTERNAL_CALLER_KEY,
  limiterFails = false,
}: {
  verification?: ApiKeyVerification;
  rateLimit?: RateLimitState;
  internalCallerKey?: string;
  limiterFails?: boolean;
} = {}) {
  const apiKeysService = {
    verify: jest.fn().mockResolvedValue(verification),
    touchLastUsed: jest.fn().mockResolvedValue(true),
  };
  const rateLimiter = {
    hit: limiterFails
      ? jest.fn().mockRejectedValue(new Error('Redis is down'))
      : jest.fn().mockResolvedValue(rateLimit),
  };
  const cls = { set: jest.fn() };
  const config = {
    get: (key: string) =>
      key === 'INTERNAL_CALLER_KEY' ? internalCallerKey : undefined,
  };
  const guard = new ApiKeyGuard(
    apiKeysService as unknown as ApiKeysService,
    rateLimiter as unknown as ApiKeyRateLimiterService,
    cls as unknown as ClsService,
    config as unknown as ConfigService,
  );

  // Kept outside call(), so a refused request's headers can still be checked.
  let request = {} as PartnerRequest;
  let responseHeaders: Record<string, unknown> = {};
  const call = (headers: Record<string, string> = {}) => {
    request = {
      headers,
      method: 'GET',
      path: '/api/v1/me',
    } as unknown as PartnerRequest;
    responseHeaders = {};
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({
          setHeader: (name: string, value: unknown) => {
            responseHeaders[name] = value;
          },
        }),
      }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  };

  return {
    call,
    lastRequest: () => request,
    lastResponseHeaders: () => responseHeaders,
    apiKeysService,
    rateLimiter,
    cls,
  };
}

/** What a refused request failed with: its status and error code. */
async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    const exception = error as DomainException;
    return { status: exception.getStatus(), code: exception.code };
  }
  throw new Error('Expected the guard to refuse the request');
}

beforeEach(() => {
  jest.spyOn(Date, 'now').mockReturnValue(NOW);
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

describe('ApiKeyGuard: the key', () => {
  it('is a 401 (14003) without X-API-Key, and checks nothing else', async () => {
    const { call, apiKeysService } = setup();
    expect(await refusal(call())).toEqual({
      status: HttpStatus.UNAUTHORIZED,
      code: PublicApiErrorCodes.ApiKeyMissing,
    });
    expect(await refusal(call({ 'x-api-key': '   ' }))).toMatchObject({
      code: PublicApiErrorCodes.ApiKeyMissing,
    });
    expect(apiKeysService.verify).not.toHaveBeenCalled();
  });

  it.each([
    [
      ApiKeyRejection.INVALID,
      HttpStatus.UNAUTHORIZED,
      PublicApiErrorCodes.ApiKeyInvalid,
    ],
    [
      ApiKeyRejection.REVOKED,
      HttpStatus.UNAUTHORIZED,
      PublicApiErrorCodes.ApiKeyRevoked,
    ],
    [
      ApiKeyRejection.BRANCH_INACTIVE,
      HttpStatus.FORBIDDEN,
      PublicApiErrorCodes.ApiKeyBranchDeactivated,
    ],
  ])('turns %s into a %i (%i)', async (reason, status, code) => {
    const { call, rateLimiter, apiKeysService } = setup({
      verification: { valid: false, reason },
    });
    expect(await refusal(call({ 'x-api-key': KEY }))).toEqual({
      status,
      code,
    });
    expect(rateLimiter.hit).not.toHaveBeenCalled();
    expect(apiKeysService.touchLastUsed).not.toHaveBeenCalled();
  });

  it('lets a valid key in: the partner goes on the request and in CLS, and the key is marked used', async () => {
    const { call, lastRequest, apiKeysService, cls } = setup();
    expect(await call({ 'x-api-key': ` ${KEY} ` })).toBe(true);

    expect(apiKeysService.verify).toHaveBeenCalledWith(KEY);
    expect(lastRequest().partner).toEqual({ ...principal, isInternal: false });
    expect(cls.set).toHaveBeenCalledWith(
      PARTNER_CONTEXT_KEY,
      lastRequest().partner,
    );
    expect(apiKeysService.touchLastUsed).toHaveBeenCalledWith('key-1');
  });
});

describe('ApiKeyGuard: the rate limit', () => {
  it('counts the request and sends the X-RateLimit-* headers', async () => {
    const { call, rateLimiter, lastResponseHeaders } = setup();
    await call({ 'x-api-key': KEY });

    expect(rateLimiter.hit).toHaveBeenCalledWith('key-1');
    expect(lastResponseHeaders()).toEqual({
      'X-RateLimit-Limit': 60,
      'X-RateLimit-Remaining': 59,
      'X-RateLimit-Reset': Math.ceil((NOW + 30_000) / 1000),
    });
  });

  it('is a 429 (14007) past the limit, and says when to come back', async () => {
    const { call, lastRequest, lastResponseHeaders } = setup({
      rateLimit: {
        limit: 60,
        remaining: 0,
        resetAt: NOW + 12_500,
        exceeded: true,
      },
    });
    expect(await refusal(call({ 'x-api-key': KEY }))).toEqual({
      status: HttpStatus.TOO_MANY_REQUESTS,
      code: PublicApiErrorCodes.ApiKeyRateLimited,
    });
    expect(lastResponseHeaders()).toMatchObject({
      'Retry-After': 13,
      'X-RateLimit-Remaining': 0,
    });
    expect(lastRequest().partner).toBeUndefined();
  });

  it('lets the request through when Redis is down, and logs it', async () => {
    const { call, lastResponseHeaders } = setup({ limiterFails: true });
    expect(await call({ 'x-api-key': KEY })).toBe(true);
    expect(lastResponseHeaders()).toEqual({});
    expect(Logger.prototype.warn).toHaveBeenCalled();
  });
});

describe('ApiKeyGuard: X-Internal-Key', () => {
  it('a match marks the caller internal, skips the rate limit, and is logged', async () => {
    const { call, lastRequest, lastResponseHeaders, rateLimiter } = setup();
    await call({ 'x-api-key': KEY, 'x-internal-key': INTERNAL_CALLER_KEY });

    expect(lastRequest().partner?.isInternal).toBe(true);
    expect(rateLimiter.hit).not.toHaveBeenCalled();
    expect(lastResponseHeaders()).toEqual({});
    expect(Logger.prototype.log).toHaveBeenCalled();
  });

  it('a wrong value is simply not internal: rate-limited like anyone else', async () => {
    const { call, lastRequest, rateLimiter } = setup();
    await call({ 'x-api-key': KEY, 'x-internal-key': 'not-the-secret' });

    expect(lastRequest().partner?.isInternal).toBe(false);
    expect(rateLimiter.hit).toHaveBeenCalled();
  });

  it('is ignored when INTERNAL_CALLER_KEY is unset', async () => {
    const { call, lastRequest, rateLimiter } = setup({ internalCallerKey: '' });
    await call({ 'x-api-key': KEY, 'x-internal-key': INTERNAL_CALLER_KEY });

    expect(lastRequest().partner?.isInternal).toBe(false);
    expect(rateLimiter.hit).toHaveBeenCalled();
  });

  it('never replaces the API key', async () => {
    const withoutKey = setup();
    expect(
      await refusal(withoutKey.call({ 'x-internal-key': INTERNAL_CALLER_KEY })),
    ).toMatchObject({ code: PublicApiErrorCodes.ApiKeyMissing });

    const withBadKey = setup({
      verification: { valid: false, reason: ApiKeyRejection.INVALID },
    });
    expect(
      await refusal(
        withBadKey.call({
          'x-api-key': KEY,
          'x-internal-key': INTERNAL_CALLER_KEY,
        }),
      ),
    ).toMatchObject({ code: PublicApiErrorCodes.ApiKeyInvalid });
  });
});
