import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum PublicApiErrorCodes {
  ApiKeyNotFound = 14001,
  ApiKeyBranchInactive = 14002,
}

export enum PublicApiErrorMessages {
  ApiKeyNotFound = 'errors.API_KEY_NOT_FOUND',
  ApiKeyBranchInactive = 'errors.API_KEY_BRANCH_INACTIVE',
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
