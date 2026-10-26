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
 *   9000-9999  File Storage
 *   11000-11999  Chat
 *   12000-12999  Notifications
 *   13000-13999  Queues
 *   14000-14999  Contacts (reassigned from 10000-10999, then from 12000-12999
 *                after colliding with Notifications on merge with main)
 *   16000-16999  Public API (API keys, partner endpoints)
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
