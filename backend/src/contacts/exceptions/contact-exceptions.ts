import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

/** Contacts domain error codes (12000-12999, reassigned from 10000-10999 — see error-types.ts) */
export enum ContactErrorCodes {
  ContactNotFound = 12001,
  ContactAlreadyExists = 12002,
  ContactScopeViolation = 12003,
  ContactSelfRequest = 12004,
  ContactNotPending = 12005,
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
