import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Request } from 'express';
import { ClsService } from 'nestjs-cls';
import { RequestUser } from '../../context/auth-context.types';
import { RedisEndpointCacheService } from '../services/redis-endpoint-cache.service';
import { RateLimitDomainService } from '../services/rate-limit-domain.service';
import { RateLimitErrorHandlerService } from '../services/rate-limit-error-handler.service';
import {
  RateLimitContext,
  GlobalRateLimitConfig,
} from '../interfaces/rate-limit.interfaces';
import { RateLimitExceededException } from '../exceptions/rate-limit.exceptions';
import {
  RATE_LIMIT_KEY,
  type RateLimitOptions,
} from '../decorators/rate-limit.decorator';

// Symbol (not a plain property) so this can't collide with anything else stashed on `request`.
const RATE_LIMIT_TRACKING_SYMBOL = Symbol('rateLimitFirstExecution');

interface AuthenticatedRequest extends Request {
  user?: RequestUser;
  [RATE_LIMIT_TRACKING_SYMBOL]?: number;
}

/**
 * Registered globally (APP_GUARD). Because this runs before JwtAuthGuard
 * attaches `request.user` (global guards run in registration order, and
 * this one is registered first), it can't check user-tier limits on its
 * first pass. If a route also applies this guard again post-auth (e.g. via
 * @UseGuards after @UseGuards(JwtAuthGuard)), this SAME guard instance runs
 * a second time for that request — tracked via a per-request timestamp
 * stashed under RATE_LIMIT_TRACKING_SYMBOL — and that second pass is where
 * the authenticated-user limit gets checked. Until the Auth module exists
 * and JwtAuthGuard is wired, every request only ever hits the first-pass
 * branch (global + IP + endpoint) — that's expected, not a bug.
 */
@Injectable()
export class EnhancedThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(EnhancedThrottlerGuard.name);
  private configCache: GlobalRateLimitConfig | null = null;
  private configCacheExpiry = 0;
  private readonly configCacheTtl: number;

  // eslint-disable-next-line max-params
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly redisEndpointCache: RedisEndpointCacheService,
    private readonly rateLimitDomainService: RateLimitDomainService,
    private readonly cls: ClsService,
    private readonly errorHandler: RateLimitErrorHandlerService,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
    this.configCacheTtl = this.configService.get<number>(
      'RATE_LIMIT_CONFIG_CACHE_TTL',
      30_000,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (this.isExcludedPath(request.path, request.method)) {
      return true;
    }

    const rateLimitContext = this.buildRateLimitContext(context, request);
    const hasUser = !!rateLimitContext.userId;

    const now = Date.now();
    request[RATE_LIMIT_TRACKING_SYMBOL] ??= now;
    const isFirstExecution = request[RATE_LIMIT_TRACKING_SYMBOL] === now;

    try {
      const config = await this.getConfig();

      if (isFirstExecution) {
        await this.rateLimitDomainService.checkGlobalRateLimit(
          rateLimitContext,
          config,
        );
        await this.rateLimitDomainService.checkIpRateLimit(
          rateLimitContext,
          config,
        );

        const decoratorOptions =
          this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
            context.getHandler(),
            context.getClass(),
          ]);
        const decoratorRule =
          decoratorOptions?.limit != null && decoratorOptions?.ttl != null
            ? {
                limit: decoratorOptions.limit,
                ttl: decoratorOptions.ttl,
                tier: decoratorOptions.tier,
              }
            : undefined;
        await this.rateLimitDomainService.checkEndpointRateLimit(
          rateLimitContext,
          decoratorRule,
        );
      }

      if (!isFirstExecution && hasUser) {
        await this.rateLimitDomainService.checkUserRateLimit(
          rateLimitContext,
          config,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof RateLimitExceededException) {
        this.errorHandler.handleRateLimitViolation(rateLimitContext, error);
        throw error;
      }

      this.errorHandler.handleRateLimitError(
        rateLimitContext,
        error instanceof Error ? error : new Error(String(error)),
        'rate_limit_check',
      );
      // Fail open — a rate-limiting bug/outage should degrade, not take the API down.
      return true;
    }
  }

  async getErrorMessage(): Promise<string> {
    return 'Rate limit exceeded. Please try again later.';
  }

  private buildRateLimitContext(
    context: ExecutionContext,
    request: AuthenticatedRequest,
  ): RateLimitContext {
    return {
      ip: this.getClientIP(request),
      userId: this.extractUserId(request),
      endpoint: request.path,
      method: request.method,
      userAgent: request.get('user-agent'),
    };
  }

  private extractUserId(request: AuthenticatedRequest): string | undefined {
    try {
      const clsUser = this.cls.get<RequestUser>('user');
      if (clsUser?.id && this.isValidUserId(clsUser.id)) {
        return clsUser.id;
      }

      const reqUser = request.user;
      if (reqUser?.id && this.isValidUserId(reqUser.id)) {
        return reqUser.id;
      }

      return undefined;
    } catch (error) {
      this.logger.warn(
        `Error extracting user ID: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  private isValidUserId(userId: string): boolean {
    if (!userId || userId.length < 1 || userId.length > 100) {
      return false;
    }
    return /^[a-zA-Z0-9_-]+$/.test(userId);
  }

  private async getConfig(): Promise<GlobalRateLimitConfig> {
    const now = Date.now();
    if (this.configCache && now < this.configCacheExpiry) {
      return this.configCache;
    }
    this.configCache = this.redisEndpointCache.getGlobalConfig();
    this.configCacheExpiry = now + this.configCacheTtl;
    return this.configCache;
  }

  /**
   * `request.ip` already reflects Express's `trust proxy` setting (configured
   * in main.ts) — re-parsing x-forwarded-for here would duplicate that and
   * risk disagreeing with it.
   */
  private getClientIP(request: Request): string {
    const clientIp = request.ip ?? request.socket.remoteAddress;
    return clientIp ? this.normalizeIP(clientIp) : 'unknown';
  }

  private normalizeIP(ip: string): string {
    return ip.startsWith('::ffff:') ? ip.substring(7) : ip;
  }

  private isExcludedPath(path: string, _method: string): boolean {
    const excludedPaths = ['/api/health'];
    return excludedPaths.some((excluded) => path.startsWith(excluded));
  }
}
