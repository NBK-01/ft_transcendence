import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum OrganizationErrorCodes {
  OrganizationNotFound = 4001,
  OrganizationAlreadyExists = 4002,
}

export enum OrganizationErrorMessages {
  OrganizationNotFound = 'errors.ORGANIZATION_NOT_FOUND',
  OrganizationAlreadyExists = 'errors.ORGANIZATION_ALREADY_EXISTS',
}

export class OrganizationNotFoundException extends DomainException {
  constructor(idOrName: string) {
    super(
      {
        key: OrganizationErrorMessages.OrganizationNotFound,
        params: { id: idOrName },
      },
      HttpStatus.NOT_FOUND,
      OrganizationErrorCodes.OrganizationNotFound,
    );
  }
}

export class OrganizationAlreadyExistsException extends DomainException {
  constructor(name: string) {
    super(
      {
        key: OrganizationErrorMessages.OrganizationAlreadyExists,
        params: { name },
      },
      HttpStatus.CONFLICT,
      OrganizationErrorCodes.OrganizationAlreadyExists,
    );
  }
}
