import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Socket } from 'socket.io';
import { DomainException } from '../common/exceptions/base/error-types';

const UNKNOWN_ERROR_KEY = 'errors.UNKNOWN_ERROR';

interface WsErrorPayload {
  errorCode?: number;
  messages: string[];
}

/**
 * GlobalExceptionFilter assumes an Express request/response and has no WS
 * branch — bound only on ChatGateway, this reuses the same DomainException
 * i18n translation instead of crashing the socket ungracefully.
 */
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const client = host.switchToWs().getClient<Socket>();
    client.emit('exception', this.resolve(exception));
  }

  private resolve(exception: unknown): WsErrorPayload {
    if (exception instanceof DomainException) {
      return {
        errorCode: exception.code,
        messages: [this.translateDomainMessage(exception)],
      };
    }
    this.logger.error(exception instanceof Error ? exception.stack : exception);
    return { messages: [String(this.i18n.translate(UNKNOWN_ERROR_KEY))] };
  }

  private translateDomainMessage(exception: DomainException): string {
    const { key, params } = exception.getMessageData();
    try {
      return String(this.i18n.translate(key, { args: params }));
    } catch {
      return key;
    }
  }
}
