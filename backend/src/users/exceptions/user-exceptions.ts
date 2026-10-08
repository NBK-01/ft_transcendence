import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum UserErrorCodes {
  UserNotFound = 1001,
  UserAlreadyExists = 1002,
}

export enum UserErrorMessages {
  UserNotFound = 'errors.USER_NOT_FOUND',
  UserAlreadyExists = 'errors.USER_ALREADY_EXISTS',
}

export class UserNotFoundException extends DomainException {
  constructor(idOrEmail: string) {
    super(
      { key: UserErrorMessages.UserNotFound, params: { id: idOrEmail } },
      HttpStatus.NOT_FOUND,
      UserErrorCodes.UserNotFound,
    );
  }
}

export class UserAlreadyExistsException extends DomainException {
  constructor(email: string) {
    super(
      { key: UserErrorMessages.UserAlreadyExists, params: { email } },
      HttpStatus.CONFLICT,
      UserErrorCodes.UserAlreadyExists,
    );
  }
}
