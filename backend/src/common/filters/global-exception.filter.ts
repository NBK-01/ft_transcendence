import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  ValidationError,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';
import { ClsService } from 'nestjs-cls';
import { ConfigService } from '@nestjs/config';
import {
  DomainException,
  ErrorMessageData,
} from '../exceptions/base/error-types';
import { stripQuery, stripQueryFromText } from '../utils/strip-query';

const UNKNOWN_ERROR_KEY = 'errors.UNKNOWN_ERROR';
const INVALID_JSON_ERROR_KEY = 'errors.INVALID_JSON_BODY';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  errorCode?: number;
  messages: string[];
  traceId?: string;
}

interface ValidationErrorResponse {
  message: unknown[];
  error: string;
  statusCode: number;
}

function isValidationErrorObject(obj: unknown): obj is ValidationError {
  return (
    !!obj &&
    typeof obj === 'object' &&
    'property' in obj &&
    'constraints' in obj
  );
}

function isValidationErrorResponse(
  response: unknown,
): response is ValidationErrorResponse {
  if (!response || typeof response !== 'object') {
    return false;
  }
  const r = response as Record<string, unknown>;
  return (
    Array.isArray(r.message) &&
    r.message.length > 0 &&
    r.error === 'Bad Request' &&
    r.statusCode === 400
  );
}

/**
 * Handles, in order:
 *  1. SyntaxError from the body parser (malformed JSON) — 400, translated.
 *  2. DomainException — numeric `code` + i18n `{key, params}` message.
 *  3. Validation errors from main.ts's ValidationPipe exceptionFactory (raw
 *     ValidationError[], not flattened) — each failing constraint is
 *     translated individually (errors.VALIDATION_MINLENGTH, etc.), with the
 *     original class-validator message as fallback if no translation exists.
 *  4. Any other HttpException — message(s) passed through as-is.
 *  5. Anything else (a bug) — generic 500, no internal detail leaked.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    private readonly i18n: I18nService,
    private readonly cls: ClsService,
    private readonly configService: ConfigService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = this.cls.getId?.();
    const lang = (request.headers['accept-language'] as string) || 'en';

    const { statusCode, errorCode, messages } = this.resolve(exception, lang);

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

    this.logError(exception, body, request, traceId);
    response.status(statusCode).json(body);
  }

  private resolve(
    exception: unknown,
    lang: string,
  ): { statusCode: number; errorCode?: number; messages: string[] } {
    if (
      exception instanceof SyntaxError &&
      this.looksLikeJsonParseError(exception)
    ) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        messages: [
          String(this.i18n.translate(INVALID_JSON_ERROR_KEY, { lang })),
        ],
      };
    }

    if (exception instanceof DomainException) {
      return {
        statusCode: exception.getStatus(),
        errorCode: exception.code,
        messages: [
          this.translateDomainMessage(exception.getMessageData(), lang),
        ],
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();

      // Express's body-parser throws a raw SyntaxError on malformed JSON, but by the time it
      // reaches here Nest's platform-express adapter has already wrapped it into a plain
      // BadRequestException — so the `instanceof SyntaxError` branch above never actually
      // fires for this case; detect it by message shape instead.
      if (
        status === HttpStatus.BAD_REQUEST &&
        this.looksLikeJsonParseErrorPayload(payload)
      ) {
        return {
          statusCode: status,
          messages: [
            String(this.i18n.translate(INVALID_JSON_ERROR_KEY, { lang })),
          ],
        };
      }

      if (isValidationErrorResponse(payload)) {
        return {
          statusCode: status,
          messages: this.translateValidationErrors(payload.message, lang),
        };
      }

      return { statusCode: status, messages: this.extractMessages(payload) };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      messages: [String(this.i18n.translate(UNKNOWN_ERROR_KEY, { lang }))],
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

  private translateDomainMessage(data: ErrorMessageData, lang: string): string {
    try {
      return this.i18n.translate(data.key, { lang, args: data.params });
    } catch {
      return data.key;
    }
  }

  // ==================== Validation error translation ====================

  private translateValidationErrors(errors: unknown[], lang: string): string[] {
    const messages: string[] = [];
    for (const error of errors) {
      if (isValidationErrorObject(error)) {
        this.processValidationError(error, '', lang, messages);
      } else {
        messages.push(String(error));
      }
    }
    return messages.length > 0
      ? messages
      : [String(this.i18n.translate(UNKNOWN_ERROR_KEY, { lang }))];
  }

  private processValidationError(
    error: ValidationError,
    path: string,
    lang: string,
    messages: string[],
  ): void {
    const fieldPath = path ? `${path}.${error.property}` : error.property;

    if (error.constraints) {
      for (const [constraintType, fallbackMessage] of Object.entries(
        error.constraints,
      )) {
        messages.push(
          this.translateConstraint(
            constraintType,
            fieldPath,
            lang,
            fallbackMessage,
          ),
        );
      }
    }

    if (error.children?.length) {
      for (const child of error.children) {
        this.processValidationError(child, fieldPath, lang, messages);
      }
    }
  }

  /** Translates one failing constraint, falling back to class-validator's own English message if no key exists for it yet. */
  private translateConstraint(
    constraintType: string,
    field: string,
    lang: string,
    fallbackMessage: string,
  ): string {
    const key = `errors.VALIDATION_${constraintType.toUpperCase()}`;
    try {
      const translated = this.i18n.translate(key, {
        lang,
        args: this.extractConstraintParams(fallbackMessage, field),
      });
      // nestjs-i18n returns the key itself when no translation exists for it.
      if (translated === key) {
        return fallbackMessage;
      }
      return String(translated);
    } catch {
      return fallbackMessage;
    }
  }

  /**
   * class-validator's default messages embed the limit values in English prose
   * (e.g. "email must be longer than or equal to 8 characters") — rather than
   * re-deriving min/max from validation metadata (a bigger lift), this pulls
   * the first number(s) out of that string so {min}/{max} placeholders still work.
   */
  private extractConstraintParams(
    fallbackMessage: string,
    field: string,
  ): Record<string, unknown> {
    const numbers = fallbackMessage.match(/\d+/g)?.map(Number) ?? [];
    return {
      field,
      min: numbers[0],
      max: numbers[numbers.length - 1],
      enum: fallbackMessage,
    };
  }

  private looksLikeJsonParseError(error: SyntaxError): boolean {
    return this.looksLikeJsonParseErrorMessage(error.message);
  }

  private looksLikeJsonParseErrorPayload(payload: unknown): boolean {
    const message =
      typeof payload === 'object' && payload !== null
        ? (payload as { message?: unknown }).message
        : payload;
    return (
      typeof message === 'string' &&
      this.looksLikeJsonParseErrorMessage(message)
    );
  }

  private looksLikeJsonParseErrorMessage(message: string): boolean {
    const lower = message.toLowerCase();
    return (
      lower.includes('unexpected token') ||
      lower.includes('unexpected end of json') ||
      (lower.includes('json') &&
        (lower.includes('position') || lower.includes('not valid')))
    );
  }

  // ==================== Logging ====================

  private logError(
    exception: unknown,
    body: ErrorResponseBody,
    request: Request,
    traceId: string | undefined,
  ): void {
    if (body.statusCode < 500) {
      return;
    }

    const isDev = this.configService.get('NODE_ENV') === 'development';
    const prefix = this.buildLogPrefix(
      traceId,
      body.statusCode,
      body.errorCode,
      request,
    );

    if (!isDev) {
      // Structured, single-line — stripped of query strings (e.g. `?email=`) which can carry PII.
      this.logger.error({
        msg: prefix,
        messages: stripQueryFromText(body.messages, request.originalUrl),
      });
      return;
    }

    const reason = stripQueryFromText(body.messages, request.originalUrl).join(
      '; ',
    );
    const trace =
      exception instanceof Error
        ? (exception.stack ?? exception.message)
        : this.safeStringify(exception);
    this.logger.error(prefix, reason ? `${reason}\n${trace}` : trace);
  }

  private buildLogPrefix(
    traceId: string | undefined,
    statusCode: number,
    errorCode: number | undefined,
    request: Request,
  ): string {
    const parts = [`[${traceId}]`, `Status ${statusCode}`];
    if (errorCode !== undefined) {
      parts.push(`Code ${errorCode}`);
    }
    parts.push(`- ${request.method} ${stripQuery(request.originalUrl)}`);
    return parts.join(' ');
  }

  private safeStringify(exception: unknown): string {
    try {
      return JSON.stringify(exception);
    } catch {
      return `Unknown error type: ${Object.prototype.toString.call(exception)}`;
    }
  }
}
