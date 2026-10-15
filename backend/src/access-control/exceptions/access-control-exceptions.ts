import { HttpStatus } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/base/error-types';

export enum AccessControlErrorCodes {
  InsufficientPermissions = 7001,
  NotInternalUser = 7002,
  InternalUserInactive = 7003,
  RoleNotFound = 7004,
  PermissionNotFound = 7005,
}

export enum AccessControlErrorMessages {
  InsufficientPermissions = 'errors.INSUFFICIENT_PERMISSIONS',
  NotInternalUser = 'errors.NOT_INTERNAL_USER',
  InternalUserInactive = 'errors.INTERNAL_USER_INACTIVE',
  RoleNotFound = 'errors.ROLE_NOT_FOUND',
  PermissionNotFound = 'errors.PERMISSION_NOT_FOUND',
}

export class InsufficientPermissionsException extends DomainException {
  constructor() {
    super(
      { key: AccessControlErrorMessages.InsufficientPermissions },
      HttpStatus.FORBIDDEN,
      AccessControlErrorCodes.InsufficientPermissions,
    );
  }
}

/** Thrown when a route requires staff but the authenticated principal is a customer. */
export class NotInternalUserException extends DomainException {
  constructor() {
    super(
      { key: AccessControlErrorMessages.NotInternalUser },
      HttpStatus.FORBIDDEN,
      AccessControlErrorCodes.NotInternalUser,
    );
  }
}

export class InternalUserInactiveException extends DomainException {
  constructor() {
    super(
      { key: AccessControlErrorMessages.InternalUserInactive },
      HttpStatus.UNAUTHORIZED,
      AccessControlErrorCodes.InternalUserInactive,
    );
  }
}

export class RoleNotFoundException extends DomainException {
  constructor(idOrName: string) {
    super(
      {
        key: AccessControlErrorMessages.RoleNotFound,
        params: { id: idOrName },
      },
      HttpStatus.NOT_FOUND,
      AccessControlErrorCodes.RoleNotFound,
    );
  }
}

export class PermissionNotFoundException extends DomainException {
  constructor(idOrName: string) {
    super(
      {
        key: AccessControlErrorMessages.PermissionNotFound,
        params: { id: idOrName },
      },
      HttpStatus.NOT_FOUND,
      AccessControlErrorCodes.PermissionNotFound,
    );
  }
}
