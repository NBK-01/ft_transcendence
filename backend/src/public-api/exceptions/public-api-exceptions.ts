import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum PublicApiErrorCodes {
  ApiKeyNotFound = 16001,
  ApiKeyBranchInactive = 16002,
  ApiKeyMissing = 16003,
  ApiKeyInvalid = 16004,
  ApiKeyRevoked = 16005,
  ApiKeyBranchDeactivated = 16006,
  ApiKeyRateLimited = 16007,
  PartnerCustomerNotFound = 16008,
}

export enum PublicApiErrorMessages {
  ApiKeyNotFound = 'errors.API_KEY_NOT_FOUND',
  ApiKeyBranchInactive = 'errors.API_KEY_BRANCH_INACTIVE',
  ApiKeyMissing = 'errors.API_KEY_MISSING',
  ApiKeyInvalid = 'errors.API_KEY_INVALID',
  ApiKeyRevoked = 'errors.API_KEY_REVOKED',
  ApiKeyBranchDeactivated = 'errors.API_KEY_BRANCH_DEACTIVATED',
  ApiKeyRateLimited = 'errors.API_KEY_RATE_LIMITED',
  PartnerCustomerNotFound = 'errors.PARTNER_CUSTOMER_NOT_FOUND',
}

export class ApiKeyNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      { key: PublicApiErrorMessages.ApiKeyNotFound, params: { id } },
      HttpStatus.NOT_FOUND,
      PublicApiErrorCodes.ApiKeyNotFound,
    );
  }
}

/** A key for a deactivated branch would be refused on every call, so it isn't created. */
export class ApiKeyBranchInactiveException extends DomainException {
  constructor(branchName: string) {
    super(
      {
        key: PublicApiErrorMessages.ApiKeyBranchInactive,
        params: { name: branchName },
      },
      HttpStatus.BAD_REQUEST,
      PublicApiErrorCodes.ApiKeyBranchInactive,
    );
  }
}

/* -------------------------------------------------------------------------
 * The public API's guard (ApiKeyGuard)
 * ----------------------------------------------------------------------- */

export class ApiKeyMissingException extends DomainException {
  constructor() {
    super(
      { key: PublicApiErrorMessages.ApiKeyMissing },
      HttpStatus.UNAUTHORIZED,
      PublicApiErrorCodes.ApiKeyMissing,
    );
  }
}

/** Malformed, unknown, or wrong: never says which, so a guess learns nothing. */
export class ApiKeyInvalidException extends DomainException {
  constructor() {
    super(
      { key: PublicApiErrorMessages.ApiKeyInvalid },
      HttpStatus.UNAUTHORIZED,
      PublicApiErrorCodes.ApiKeyInvalid,
    );
  }
}

/** Only ever sent for the real key (bcrypt confirmed it), so it tells its holder to get a new one. */
export class ApiKeyRevokedException extends DomainException {
  constructor() {
    super(
      { key: PublicApiErrorMessages.ApiKeyRevoked },
      HttpStatus.UNAUTHORIZED,
      PublicApiErrorCodes.ApiKeyRevoked,
    );
  }
}

/** A valid key whose branch was deactivated: the key is fine, the branch may not act. */
export class ApiKeyBranchDeactivatedException extends DomainException {
  constructor() {
    super(
      { key: PublicApiErrorMessages.ApiKeyBranchDeactivated },
      HttpStatus.FORBIDDEN,
      PublicApiErrorCodes.ApiKeyBranchDeactivated,
    );
  }
}

export class ApiKeyRateLimitedException extends DomainException {
  constructor(limit: number, retryAfterSeconds: number) {
    super(
      {
        key: PublicApiErrorMessages.ApiKeyRateLimited,
        params: { limit, retryAfter: retryAfterSeconds },
      },
      HttpStatus.TOO_MANY_REQUESTS,
      PublicApiErrorCodes.ApiKeyRateLimited,
    );
  }
}

/* -------------------------------------------------------------------------
 * Partner shipments
 * ----------------------------------------------------------------------- */

/** No active customer account with that email: a partner can't create accounts. */
export class PartnerCustomerNotFoundException extends DomainException {
  // Doesn't repeat the email: the caller already has it, and logs shouldn't collect it.
  constructor() {
    super(
      { key: PublicApiErrorMessages.PartnerCustomerNotFound },
      HttpStatus.NOT_FOUND,
      PublicApiErrorCodes.PartnerCustomerNotFound,
    );
  }
}
