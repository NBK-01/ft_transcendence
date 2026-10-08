import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';

const SKIP_PATHS = ['/api/health', '/api/health/live', '/api/health/ready'];

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (SKIP_PATHS.includes(req.originalUrl)) {
      next();
      return;
    }

    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const traceId = this.cls.getId?.();
      this.logger.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms${traceId ? ` [${traceId}]` : ''}`,
      );
    });
    next();
  }
}
