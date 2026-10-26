import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum InternalUserErrorCodes {
  InternalUserNotFound = 8001,
  InternalUserAlreadyExists = 8002,
  // 8003-8006 are taken by StaffAuthErrorCodes, which shares this block.
  CannotRemoveLastAdmin = 8007,
}

export enum InternalUserErrorMessages {
  InternalUserNotFound = 'errors.INTERNAL_USER_NOT_FOUND',
  InternalUserAlreadyExists = 'errors.INTERNAL_USER_ALREADY_EXISTS',
  CannotRemoveLastAdmin = 'errors.CANNOT_REMOVE_LAST_ADMIN',
}

export class InternalUserNotFoundException extends DomainException {
  constructor(idOrEmail: string) {
    super(
      {
        key: InternalUserErrorMessages.InternalUserNotFound,
        params: { id: idOrEmail },
      },
      HttpStatus.NOT_FOUND,
      InternalUserErrorCodes.InternalUserNotFound,
    );
  }
}

export class InternalUserAlreadyExistsException extends DomainException {
  constructor(email: string) {
    super(
      {
        key: InternalUserErrorMessages.InternalUserAlreadyExists,
        params: { email },
      },
      HttpStatus.CONFLICT,
      InternalUserErrorCodes.InternalUserAlreadyExists,
    );
  }
}

/** The last active admin can't deactivate or demote themselves (or be deactivated/demoted by another admin) — that would lock the system out of admin access with no recovery path. */
export class CannotRemoveLastAdminException extends DomainException {
  constructor(id: string) {
    super(
      {
        key: InternalUserErrorMessages.CannotRemoveLastAdmin,
        params: { id },
      },
      HttpStatus.CONFLICT,
      InternalUserErrorCodes.CannotRemoveLastAdmin,
    );
  }
}
