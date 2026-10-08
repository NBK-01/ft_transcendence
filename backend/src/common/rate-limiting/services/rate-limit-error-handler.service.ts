import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RateLimitContext,
  RateLimitTier,
} from '../interfaces/rate-limit.interfaces';
import { RateLimitExceededException } from '../exceptions/rate-limit.exceptions';
import { RateLimitResponseFactory } from '../factories/rate-limit-response.factory';

export interface RateLimitErrorMetrics {
  totalViolations: number;
  violationsByTier: Record<string, number>;
  violationsByEndpoint: Record<string, number>;
  recentViolations: Array<{
    timestamp: string;
    tier: string;
    endpoint: string;
    ip: string;
    userId?: string;
  }>;
}

/**
 * Logs/metrics layer around rate-limit violations — separate from
 * RateLimitDomainService so the limit-checking logic doesn't get tangled
 * with observability concerns. Also does lightweight abuse-pattern
 * detection (repeat violator, endpoint scanning) from the same in-memory
 * violation history; this is a cheap heuristic for log-based alerting, not
 * a replacement for a real WAF/IDS.
 */
@Injectable()
export class RateLimitErrorHandlerService {
  private readonly logger = new Logger(RateLimitErrorHandlerService.name);
  private readonly violationMetrics: RateLimitErrorMetrics = {
    totalViolations: 0,
    violationsByTier: {},
    violationsByEndpoint: {},
    recentViolations: [],
  };
  private readonly maxRecentViolations: number;
  private readonly abuseDetectionThreshold: number;
  private readonly scanningDetectionThreshold: number;
  private readonly recentViolationsWindow: number;

  constructor(
    private readonly responseFactory: RateLimitResponseFactory,
    private readonly configService: ConfigService,
  ) {
    this.maxRecentViolations = this.configService.get<number>(
      'RATE_LIMIT_MAX_RECENT_VIOLATIONS',
      100,
    );
    this.abuseDetectionThreshold = this.configService.get<number>(
      'RATE_LIMIT_ABUSE_DETECTION_THRESHOLD',
      5,
    );
    this.scanningDetectionThreshold = this.configService.get<number>(
      'RATE_LIMIT_SCANNING_DETECTION_THRESHOLD',
      3,
    );
    this.recentViolationsWindow = this.configService.get<number>(
      'RATE_LIMIT_RECENT_VIOLATIONS_WINDOW',
      10,
    );
  }

  handleRateLimitViolation(
    context: RateLimitContext,
    error: RateLimitExceededException,
  ): void {
    try {
      this.updateViolationMetrics(context, error);

      const logEntry = this.responseFactory.createViolationLogEntry(
        context,
        error,
      );
      const message = this.responseFactory.formatViolationMessage(
        context,
        error,
      );
      const logLevel = this.determineLogLevel(error);
      this.logViolation(
        logLevel,
        message,
        logEntry as unknown as Record<string, unknown>,
      );

      this.checkForAbusePatterns(context);
    } catch (handlerError) {
      this.logger.error('Error in rate limit violation handler', {
        originalError: error.message,
        handlerError:
          handlerError instanceof Error
            ? handlerError.message
            : String(handlerError),
        context: {
          endpoint: context.endpoint,
          method: context.method,
          ip: context.ip,
          userId: context.userId,
        },
      });
    }
  }

  handleRateLimitError(
    context: RateLimitContext,
    error: Error,
    operation: string,
  ): void {
    const errorMessage = `Rate limiting system error during ${operation} for ${context.endpoint}`;
    this.logger.error(errorMessage, {
      operation,
      endpoint: context.endpoint,
      method: context.method,
      ip: context.ip,
      userId: context.userId,
      error: { name: error.name, message: error.message, stack: error.stack },
      timestamp: new Date().toISOString(),
    });

    if (this.isCriticalError(error)) {
      this.logger.error('CRITICAL: Rate limiting system failure', {
        operation,
        endpoint: context.endpoint,
        error: { name: error.name, message: error.message },
        action: 'critical_error',
        requiresAttention: true,
      });
    }
  }

  handleStorageReset(key: string, reason: string): void {
    this.logger.warn('Rate limit storage reset triggered', {
      key,
      reason,
      timestamp: new Date().toISOString(),
      action: 'storage_reset',
    });
  }

  handleStorageInconsistency(
    key: string,
    result: { totalHits: number; isBlocked: boolean },
  ): void {
    this.logger.warn('Rate limit storage inconsistency detected', {
      key,
      totalHits: result.totalHits,
      isBlocked: result.isBlocked,
      timestamp: new Date().toISOString(),
      action: 'inconsistency_detected',
    });
  }

  getViolationMetrics(): RateLimitErrorMetrics {
    return {
      ...this.violationMetrics,
      recentViolations: [...this.violationMetrics.recentViolations].reverse(),
    };
  }

  clearMetrics(): void {
    this.violationMetrics.totalViolations = 0;
    this.violationMetrics.violationsByTier = {};
    this.violationMetrics.violationsByEndpoint = {};
    this.violationMetrics.recentViolations = [];
  }

  private updateViolationMetrics(
    context: RateLimitContext,
    error: RateLimitExceededException,
  ): void {
    const errorResponse = error.getResponse() as { tier?: string };
    const tierValue = errorResponse.tier ?? 'unknown';
    const endpointKey = `${context.method} ${context.endpoint}`;

    this.violationMetrics.totalViolations++;
    this.violationMetrics.violationsByTier[tierValue] =
      (this.violationMetrics.violationsByTier[tierValue] ?? 0) + 1;
    this.violationMetrics.violationsByEndpoint[endpointKey] =
      (this.violationMetrics.violationsByEndpoint[endpointKey] ?? 0) + 1;

    this.violationMetrics.recentViolations.push({
      timestamp: new Date().toISOString(),
      tier: tierValue,
      endpoint: endpointKey,
      ip: context.ip,
      userId: context.userId,
    });

    if (
      this.violationMetrics.recentViolations.length > this.maxRecentViolations
    ) {
      this.violationMetrics.recentViolations.shift();
    }
  }

  private determineLogLevel(
    error: RateLimitExceededException,
  ): 'warn' | 'error' {
    const tierValue = (error.getResponse() as { tier?: string }).tier;
    return tierValue === RateLimitTier.ENDPOINT ? 'error' : 'warn';
  }

  private logViolation(
    level: 'warn' | 'error',
    message: string,
    logEntry: Record<string, unknown>,
  ): void {
    if (level === 'error') {
      this.logger.error(message, { violation: logEntry });
    } else {
      this.logger.warn(message, { violation: logEntry });
    }
  }

  private checkForAbusePatterns(context: RateLimitContext): void {
    const recentIpViolations = this.violationMetrics.recentViolations
      .filter((v) => v.ip === context.ip)
      .slice(-this.recentViolationsWindow);

    if (recentIpViolations.length >= this.abuseDetectionThreshold) {
      this.logger.error(`Potential abuse detected from IP: ${context.ip}`, {
        ip: context.ip,
        recentViolationCount: recentIpViolations.length,
        violations: recentIpViolations,
        threshold: this.abuseDetectionThreshold,
        action: 'abuse_pattern_detected',
      });
    }

    if (context.endpoint && context.ip) {
      const ipViolationEndpoints = new Set(
        this.violationMetrics.recentViolations
          .filter((v) => v.ip === context.ip)
          .map((v) => v.endpoint),
      );

      if (ipViolationEndpoints.size >= this.scanningDetectionThreshold) {
        this.logger.error(
          `Potential endpoint scanning detected from IP: ${context.ip}`,
          {
            ip: context.ip,
            uniqueEndpoints: Array.from(ipViolationEndpoints),
            endpointCount: ipViolationEndpoints.size,
            threshold: this.scanningDetectionThreshold,
            action: 'scanning_pattern_detected',
          },
        );
      }
    }
  }

  private isCriticalError(error: Error): boolean {
    const criticalErrorTypes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'];
    return criticalErrorTypes.some(
      (type) => error.message.includes(type) || error.name.includes(type),
    );
  }
}
