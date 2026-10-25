import { Logger as NestLogger } from '@nestjs/common';
import { AdvancedConsoleLogger, QueryRunner } from 'typeorm';

const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * TypeORM's default logger reports every failed query at `error` severity, even ones
 * the application already recovers from. ChatService's findOrInsert* methods (see
 * findOrInsertSupportConversation / findOrInsertStaffDm) treat a unique-constraint
 * violation on INSERT as an expected concurrency race — two requests racing to create
 * the same safety-net row — and recover by re-selecting the row the other request just
 * won. Logging that at `error` buries genuine failures in noise for a path that already
 * succeeds (the HTTP response is a 201 either way). Everything else still logs exactly
 * as TypeORM's default logger would.
 */
export class BenignQueryErrorLogger extends AdvancedConsoleLogger {
  private readonly nestLogger = new NestLogger('TypeORM');

  logQueryError(
    error: string | Error,
    query: string,
    parameters?: unknown[],
    queryRunner?: QueryRunner,
  ): void {
    if (!this.isUniqueConstraintViolation(error)) {
      // AbstractLogger's own signature narrows `error` to `string` even though the
      // Logger interface (and the postgres driver at runtime) pass the raw Error.
      super.logQueryError(error as string, query, parameters, queryRunner);
      return;
    }
    this.nestLogger.warn(
      `Unique constraint race recovered by caller: ${this.messageOf(error)} -- ${query}`,
    );
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (error as { code?: string })?.code === POSTGRES_UNIQUE_VIOLATION;
  }

  private messageOf(error: string | Error): string {
    return typeof error === 'string' ? error : error.message;
  }
}
