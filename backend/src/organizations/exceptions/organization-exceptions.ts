import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum OrganizationErrorCodes {
  OrganizationNotFound = 4001,
  OrganizationAlreadyExists = 4002,
  OrganizationInUse = 4003,
  StaffNotInOrganization = 4004,
  OrganizationInactive = 4005,
}

export enum OrganizationErrorMessages {
  OrganizationNotFound = 'errors.ORGANIZATION_NOT_FOUND',
  OrganizationAlreadyExists = 'errors.ORGANIZATION_ALREADY_EXISTS',
  OrganizationInUse = 'errors.ORGANIZATION_IN_USE',
  StaffNotInOrganization = 'errors.STAFF_NOT_IN_ORGANIZATION',
  OrganizationInactive = 'errors.ORGANIZATION_INACTIVE',
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

/** A branch still has staff, shipments or API keys: deactivate it instead. */
export class OrganizationInUseException extends DomainException {
  constructor(name: string) {
    super(
      { key: OrganizationErrorMessages.OrganizationInUse, params: { name } },
      HttpStatus.CONFLICT,
      OrganizationErrorCodes.OrganizationInUse,
    );
  }
}

/** Removing a staff member from a branch they aren't in. */
export class StaffNotInOrganizationException extends DomainException {
  constructor(internalUserId: string) {
    super(
      {
        key: OrganizationErrorMessages.StaffNotInOrganization,
        params: { id: internalUserId },
      },
      HttpStatus.NOT_FOUND,
      OrganizationErrorCodes.StaffNotInOrganization,
    );
  }
}

/** A deactivated branch takes no new work: reactivate it first. */
export class OrganizationInactiveException extends DomainException {
  constructor(name: string) {
    super(
      { key: OrganizationErrorMessages.OrganizationInactive, params: { name } },
      HttpStatus.CONFLICT,
      OrganizationErrorCodes.OrganizationInactive,
    );
  }
}
