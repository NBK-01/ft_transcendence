import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Reserved numeric error-code ranges per domain. Keep new domains aligned to
 * this so error codes stay unique and greppable across the whole API.
 *
 *   1000-1999  Users
 *   2000-2999  Auth
 *   3000-3999  Shipments
 *   4000-4999  Organizations
 *   5000-5999  Validation (generic, cross-domain)
 *   6000-6999  Third-party / webhooks
 *   7000-7999  Access Control (RBAC)
 *   8000-8999  Internal Users / Staff Auth
 */

export interface ErrorMessageData {
  key: string;
  params?: Record<string, unknown>;
}

export abstract class DomainException extends HttpException {
  protected constructor(
    messageData: ErrorMessageData,
    status: HttpStatus,
    public readonly code: number,
  ) {
    super(messageData, status);
  }

  getMessageData(): ErrorMessageData {
    return this.getResponse() as ErrorMessageData;
  }
}
