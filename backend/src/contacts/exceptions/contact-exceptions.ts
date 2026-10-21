import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum ContactErrorCodes {
  ContactNotFound = 10001,
  ContactAlreadyExists = 10002,
  ContactScopeViolation = 10003,
  ContactSelfRequest = 10004,
  ContactNotPending = 10005,
}

export enum ContactErrorMessages {
  ContactNotFound = 'errors.CONTACT_NOT_FOUND',
  ContactAlreadyExists = 'errors.CONTACT_ALREADY_EXISTS',
  ContactScopeViolation = 'errors.CONTACT_SCOPE_VIOLATION',
  ContactSelfRequest = 'errors.CONTACT_SELF_REQUEST',
  ContactNotPending = 'errors.CONTACT_NOT_PENDING',
}

export class ContactNotFoundException extends DomainException {
  constructor(id: string) {
    super(
      { key: ContactErrorMessages.ContactNotFound, params: { id } },
      HttpStatus.NOT_FOUND,
      ContactErrorCodes.ContactNotFound,
    );
  }
}

export class ContactAlreadyExistsException extends DomainException {
  constructor() {
    super(
      { key: ContactErrorMessages.ContactAlreadyExists },
      HttpStatus.CONFLICT,
      ContactErrorCodes.ContactAlreadyExists,
    );
  }
}

/** Requester and addressee aren't in the same organization, and neither is admin. */
export class ContactScopeViolationException extends DomainException {
  constructor() {
    super(
      { key: ContactErrorMessages.ContactScopeViolation },
      HttpStatus.FORBIDDEN,
      ContactErrorCodes.ContactScopeViolation,
    );
  }
}

export class ContactSelfRequestException extends DomainException {
  constructor() {
    super(
      { key: ContactErrorMessages.ContactSelfRequest },
      HttpStatus.BAD_REQUEST,
      ContactErrorCodes.ContactSelfRequest,
    );
  }
}

export class ContactNotPendingException extends DomainException {
  constructor() {
    super(
      { key: ContactErrorMessages.ContactNotPending },
      HttpStatus.CONFLICT,
      ContactErrorCodes.ContactNotPending,
    );
  }
}
