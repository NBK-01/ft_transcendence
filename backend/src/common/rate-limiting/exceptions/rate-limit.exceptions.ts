import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(
    limit: number,
    resetTime: number,
    retryAfter: number,
    tier: string = 'general',
  ) {
    super(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Limit: ${limit} requests. Try again in ${retryAfter} seconds.`,
        limit,
        resetTime,
        retryAfter,
        tier,
        i18nKey: 'errors.RATE_LIMIT_EXCEEDED',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

export class InvalidRateLimitPatternException extends HttpException {
  constructor(pattern: string, reason: string) {
    super(
      {
        error: 'Invalid rate limit pattern',
        message: `Pattern '${pattern}' is invalid: ${reason}`,
        pattern,
        reason,
        i18nKey: 'errors.RATE_LIMIT_INVALID_PATTERN',
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
