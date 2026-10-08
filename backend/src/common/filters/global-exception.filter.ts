import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ClsService } from 'nestjs-cls';
import {
  DomainException,
  ErrorMessageData,
} from '../exceptions/base/error-types';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  errorCode?: number;
  messages: string[];
  traceId?: string;
}

/**
 * Handles three shapes of thrown error, in this order:
 *  1. DomainException — has a numeric `code` + an i18n `{key, params}`
 *     message. errorCode is included in the response.
 *  2. Other HttpException (incl. class-validator's BadRequestException
 *     array-of-strings from ValidationPipe) — no errorCode.
 *  3. Anything else (a bug) — logged with full stack, client gets a generic
 *     500 with no internal detail leaked.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = this.cls.getId?.();

    const { statusCode, errorCode, messages } = this.resolve(
      exception,
      request,
    );

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${statusCode} [${traceId}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      messages,
      traceId,
    };
    if (errorCode !== undefined) {
      body.errorCode = errorCode;
    }

    response.status(statusCode).json(body);
  }

  private resolve(
    exception: unknown,
    request: Request,
  ): { statusCode: number; errorCode?: number; messages: string[] } {
    if (exception instanceof DomainException) {
      return {
        statusCode: exception.getStatus(),
        errorCode: exception.code,
        messages: [this.translate(exception.getMessageData(), request)],
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const messages = this.extractMessages(payload);
      return { statusCode: status, messages };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      messages: ['Internal server error'],
    };
  }

  private extractMessages(payload: unknown): string[] {
    if (typeof payload === 'string') {
      return [payload];
    }
    if (payload && typeof payload === 'object') {
      const message = (payload as { message?: unknown }).message;
      if (Array.isArray(message)) {
        return message.map((m) => String(m));
      }
      if (typeof message === 'string') {
        return [message];
      }
    }
    return ['An error occurred'];
  }

  private translate(data: ErrorMessageData, request: Request): string {
    try {
      return this.i18n.translate(data.key, {
        lang: (request.headers['accept-language'] as string) || 'en',
        args: data.params,
      });
    } catch {
      // Missing translation key — fall back to the raw key rather than
      // crashing the error handler itself.
      return data.key;
    }
  }
}
