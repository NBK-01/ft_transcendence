import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum InternalUserErrorCodes {
  InternalUserNotFound = 8001,
  InternalUserAlreadyExists = 8002,
}

export enum InternalUserErrorMessages {
  InternalUserNotFound = 'errors.INTERNAL_USER_NOT_FOUND',
  InternalUserAlreadyExists = 'errors.INTERNAL_USER_ALREADY_EXISTS',
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
