import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResponseDto } from '../dto/paginated-response.dto';

interface SuccessEnvelope<T> {
  success: true;
  statusCode: number;
  data: T;
  meta?: unknown;
}

/**
 * Wraps every successful response in a standard envelope. Two things the
 * original template got wrong that this fixes:
 *  - it hardcoded statusCode: 200 always (breaks 201/204 responses) — here
 *    we read the real status off the response.
 *  - it didn't special-case paginated results — here a PaginatedResponseDto
 *    unwraps to { data: items, meta } instead of nesting the whole DTO under
 *    `data`.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  SuccessEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<SuccessEnvelope<T>> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result: unknown) => {
        const statusCode = response.statusCode;

        if (result instanceof PaginatedResponseDto) {
          return {
            success: true,
            statusCode,
            data: result.items,
            meta: result.meta,
          } as SuccessEnvelope<T>;
        }

        return {
          success: true,
          statusCode,
          data: result,
        } as SuccessEnvelope<T>;
      }),
    );
  }
}
