import { Injectable, Logger } from '@nestjs/common';
import {
  RateLimitContext,
  RateLimitTier,
} from '../interfaces/rate-limit.interfaces';
import { RateLimitExceededException } from '../exceptions/rate-limit.exceptions';

export interface RateLimitViolationLogEntry {
  timestamp: string;
  method: string;
  endpoint: string;
  ip: string;
  userId?: string;
  tier: string;
  limit: number;
  resetTime: number;
  retryAfter: number;
  userAgent?: string;
}

interface RateLimitErrorResponse {
  tier?: string;
  limit?: number;
  resetTime?: number;
  retryAfter?: number;
}

@Injectable()
export class RateLimitResponseFactory {
  private readonly logger = new Logger(RateLimitResponseFactory.name);

  createViolationLogEntry(
    context: RateLimitContext,
    error: RateLimitExceededException,
  ): RateLimitViolationLogEntry {
    const r = this.getTypedResponse(error);
    return {
      timestamp: new Date().toISOString(),
      method: context.method,
      endpoint: context.endpoint,
      ip: context.ip,
      userId: context.userId,
      tier: r.tier ?? 'unknown',
      limit: r.limit ?? 0,
      resetTime: this.validateNumericValue(r.resetTime, 0),
      retryAfter: this.validateNumericValue(r.retryAfter, 0),
      userAgent: context.userAgent,
    };
  }

  formatViolationMessage(
    context: RateLimitContext,
    error: RateLimitExceededException,
  ): string {
    const r = this.getTypedResponse(error);
    const resetTimeStr = this.formatResetTime(
      this.validateNumericValue(r.resetTime, 0),
    );
    return (
      `Rate limit exceeded: ${context.method} ${context.endpoint} - ` +
      `IP: ${context.ip}, User: ${context.userId ?? 'anonymous'}, ` +
      `Tier: ${r.tier ?? 'unknown'}, Limit: ${r.limit ?? 0}, Reset: ${resetTimeStr}`
    );
  }

  createRateLimitMetrics(
    context: RateLimitContext,
    result: { totalHits: number; isBlocked: boolean; timeToExpire: number },
    limit: number,
    tier: RateLimitTier,
  ): Record<string, unknown> {
    return {
      endpoint: context.endpoint,
      method: context.method,
      ip: context.ip,
      userId: context.userId,
      tier,
      currentHits: result.totalHits,
      limit,
      blocked: result.isBlocked,
      remaining: Math.max(0, limit - result.totalHits),
      resetTime: result.timeToExpire,
      timestamp: Date.now(),
    };
  }

  private getTypedResponse(
    error: RateLimitExceededException,
  ): RateLimitErrorResponse {
    const response = error.getResponse();
    return typeof response === 'object' && response !== null
      ? (response as RateLimitErrorResponse)
      : {};
  }

  private validateNumericValue(value: unknown, defaultValue: number): number {
    return typeof value === 'number' && !isNaN(value) && isFinite(value)
      ? value
      : defaultValue;
  }

  private formatResetTime(resetTime: number): string {
    try {
      if (resetTime <= 0 || isNaN(resetTime) || !isFinite(resetTime)) {
        return 'N/A';
      }
      const now = Date.now();
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (resetTime < now - oneYearMs || resetTime > now + oneYearMs) {
        return 'N/A';
      }
      const date = new Date(resetTime);
      return isNaN(date.getTime()) ? 'N/A' : date.toISOString();
    } catch (error) {
      this.logger.warn('Date formatting error in rate limiting:', error);
      return 'N/A';
    }
  }
}
