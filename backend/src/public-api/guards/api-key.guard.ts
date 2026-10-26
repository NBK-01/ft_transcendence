import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { DomainException } from '../../common/exceptions/base/error-types';
import { ApiKeysService } from '../api-keys.service';
import {
  ApiKeyRateLimiterService,
  RateLimitState,
} from '../services/api-key-rate-limiter.service';
import {
  API_KEY_HEADER,
  ApiKeyRejection,
  INTERNAL_CALLER_KEY_MIN_LENGTH,
  INTERNAL_KEY_HEADER,
  PARTNER_CONTEXT_KEY,
} from '../constants/api-key.constants';
import {
  ApiKeyBranchDeactivatedException,
  ApiKeyInvalidException,
  ApiKeyMissingException,
  ApiKeyRateLimitedException,
  ApiKeyRevokedException,
} from '../exceptions';
import { PartnerContext, PartnerRequest } from '../types/partner-context';
import { timingSafeCompare } from '../utils/timing-safe-compare';

/**
 * The public API's door, applied by @PartnerApi(). In order:
 *  1. an X-API-Key that ApiKeysService.verify accepts (401/403 otherwise);
 *  2. X-Internal-Key: if it matches INTERNAL_CALLER_KEY, the caller is one
 *     of our own services. It never replaces the key, and it only lifts the
 *     per-key rate limit: the key's branch still bounds what it can reach;
 *  3. the per-key rate limit (429 with Retry-After when exceeded).
 * The partner then sits on the request and in the CLS store.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);
  /** Unset: nobody is internal, whatever header they send. */
  private readonly internalCallerKey: string | undefined;

  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly rateLimiter: ApiKeyRateLimiterService,
    private readonly cls: ClsService,
    configService: ConfigService,
  ) {
    this.internalCallerKey = readInternalCallerKey(configService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<PartnerRequest>();
    const response = http.getResponse<Response>();

    const key = headerValue(request, API_KEY_HEADER);
    if (!key) {
      throw new ApiKeyMissingException();
    }
    const result = await this.apiKeysService.verify(key);
    if (!result.valid) {
      throw rejectionFor(result.reason);
    }

    // Only looked at once the key is valid: on its own the header gets nothing.
    const partner: PartnerContext = {
      ...result.apiKey,
      isInternal: this.isInternal(request),
    };
    if (partner.isInternal) {
      this.logger.log(
        `Internal call with API key ${partner.id} (${partner.name}): ${request.method} ${request.path}`,
      );
    } else {
      await this.enforceRateLimit(partner.id, response);
    }

    request.partner = partner;
    this.cls.set(PARTNER_CONTEXT_KEY, partner);
    // Never throws, and the partner shouldn't wait for it.
    void this.apiKeysService.touchLastUsed(partner.id);
    return true;
  }

  private isInternal(request: Request): boolean {
    const sent = headerValue(request, INTERNAL_KEY_HEADER);
    return Boolean(
      this.internalCallerKey &&
      sent &&
      timingSafeCompare(sent, this.internalCallerKey),
    );
  }

  /** Sends the X-RateLimit-* headers, and refuses the request past the limit. */
  private async enforceRateLimit(
    apiKeyId: string,
    response: Response,
  ): Promise<void> {
    let state: RateLimitState;
    try {
      state = await this.rateLimiter.hit(apiKeyId);
    } catch (error) {
      // Same choice as the app-wide limiter: a Redis outage degrades the
      // limit, it doesn't take the public API down.
      this.logger.warn(
        `Rate limit check failed for API key ${apiKeyId}, letting the request through: ${(error as Error).message}`,
      );
      return;
    }
    const secondsLeft = Math.max(
      1,
      Math.ceil((state.resetAt - Date.now()) / 1000),
    );
    response.setHeader('X-RateLimit-Limit', state.limit);
    response.setHeader('X-RateLimit-Remaining', state.remaining);
    response.setHeader('X-RateLimit-Reset', Math.ceil(state.resetAt / 1000));
    if (state.exceeded) {
      response.setHeader('Retry-After', secondsLeft);
      throw new ApiKeyRateLimitedException(state.limit, secondsLeft);
    }
  }
}

function headerValue(request: Request, name: string): string | undefined {
  const value = request.headers[name];
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

function rejectionFor(reason: ApiKeyRejection): DomainException {
  switch (reason) {
    case ApiKeyRejection.REVOKED:
      return new ApiKeyRevokedException();
    case ApiKeyRejection.BRANCH_INACTIVE:
      return new ApiKeyBranchDeactivatedException();
    case ApiKeyRejection.INVALID:
      return new ApiKeyInvalidException();
  }
}

/**
 * Optional; when set, long enough that a key holder can't guess it (a match
 * lifts the rate limit, and the response shows whether it matched).
 */
function readInternalCallerKey(
  configService: ConfigService,
): string | undefined {
  const key = configService.get<string>('INTERNAL_CALLER_KEY') || undefined;
  if (key && key.length < INTERNAL_CALLER_KEY_MIN_LENGTH) {
    throw new Error(
      `INTERNAL_CALLER_KEY must be at least ${INTERNAL_CALLER_KEY_MIN_LENGTH} characters (or left empty to turn it off)`,
    );
  }
  return key;
}
