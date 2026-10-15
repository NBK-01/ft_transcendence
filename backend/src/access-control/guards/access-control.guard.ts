import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AccessControlService } from '../access-control.service';
import { AuthContextService } from '../../common/context';
import { AccountType } from '../../common/context/auth-context.types';
import { ACCESS_CONTROL_KEYS } from '../../common/decorators/access-control.decorator';
import {
  InsufficientPermissionsException,
  InternalUserInactiveException,
  NotInternalUserException,
} from '../exceptions';

interface AccessControlMetadata {
  permission?: string;
  anyPermission?: string[];
  allPermissions?: string[];
  role?: string;
  anyRole?: string[];
  anyOf?: string[];
  staff?: boolean;
  skip?: boolean;
}

/**
 * Registered globally (APP_GUARD), after JwtAuthGuard — by the time this
 * runs, AuthContextService is already populated (JwtStrategy.validate()
 * does that). Fails OPEN when a route carries none of the metadata keys
 * below — same as oori's guard — so every staff-facing route needs at
 * least @RequireStaff() to avoid admitting a valid customer token.
 */
@Injectable()
export class AccessControlGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControlService: AccessControlService,
    private readonly authContext: AuthContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const metadata = this.extractMetadata(context);
    if (metadata.skip || this.isEmpty(metadata)) {
      return true;
    }

    const user = this.authContext.requireUser();
    if (user.accountType !== AccountType.STAFF) {
      throw new NotInternalUserException();
    }

    const internalUser = await this.accessControlService.getActiveInternalUser(
      user.id,
    );
    if (!internalUser?.isActive) {
      throw new InternalUserInactiveException();
    }

    if (metadata.staff && !this.hasAnyFurtherRequirement(metadata)) {
      // @RequireStaff() alone — being an active staff member is enough, no role/permission check.
      return true;
    }

    if (await this.accessControlService.isAdmin(internalUser.id)) {
      return true;
    }

    if (!(await this.checkRequirements(internalUser.id, metadata))) {
      throw new InsufficientPermissionsException();
    }
    return true;
  }

  private extractMetadata(context: ExecutionContext): AccessControlMetadata {
    const targets = [context.getHandler(), context.getClass()];
    const get = <T>(key: string) =>
      this.reflector.getAllAndOverride<T>(key, targets);
    return {
      permission: get<string>(ACCESS_CONTROL_KEYS.PERMISSION),
      anyPermission: get<string[]>(ACCESS_CONTROL_KEYS.ANY_PERMISSION),
      allPermissions: get<string[]>(ACCESS_CONTROL_KEYS.ALL_PERMISSIONS),
      role: get<string>(ACCESS_CONTROL_KEYS.ROLE),
      anyRole: get<string[]>(ACCESS_CONTROL_KEYS.ANY_ROLE),
      anyOf: get<string[]>(ACCESS_CONTROL_KEYS.ANY_OF),
      staff: get<boolean>(ACCESS_CONTROL_KEYS.STAFF),
      skip: get<boolean>(ACCESS_CONTROL_KEYS.SKIP),
    };
  }

  private isEmpty(metadata: AccessControlMetadata): boolean {
    return (
      !metadata.permission &&
      !metadata.anyPermission &&
      !metadata.allPermissions &&
      !metadata.role &&
      !metadata.anyRole &&
      !metadata.anyOf &&
      !metadata.staff
    );
  }

  private hasAnyFurtherRequirement(metadata: AccessControlMetadata): boolean {
    return !!(
      metadata.permission ||
      metadata.anyPermission ||
      metadata.allPermissions ||
      metadata.role ||
      metadata.anyRole ||
      metadata.anyOf
    );
  }

  private async checkRequirements(
    internalUserId: string,
    metadata: AccessControlMetadata,
  ): Promise<boolean> {
    const checks: Promise<boolean>[] = [];

    if (metadata.permission) {
      checks.push(
        this.accessControlService.hasPermission(
          internalUserId,
          metadata.permission,
        ),
      );
    }
    if (metadata.anyPermission) {
      checks.push(
        this.accessControlService.hasAnyPermission(
          internalUserId,
          metadata.anyPermission,
        ),
      );
    }
    if (metadata.allPermissions) {
      checks.push(
        this.accessControlService.hasAllPermissions(
          internalUserId,
          metadata.allPermissions,
        ),
      );
    }
    if (metadata.role) {
      checks.push(
        this.accessControlService.hasRole(internalUserId, metadata.role),
      );
    }
    if (metadata.anyRole) {
      checks.push(
        this.accessControlService.hasAnyRole(internalUserId, metadata.anyRole),
      );
    }
    if (metadata.anyOf) {
      checks.push(this.checkAnyOf(internalUserId, metadata.anyOf));
    }

    if (checks.length === 0) {
      // Only @RequireStaff() plus some OTHER already-passed check landed here — treat as satisfied.
      return true;
    }

    // All DECORATORS present on the route must each pass (AND across decorator types); within
    // RequireAnyOf/RequireAnyPermission it's already an OR, matching the decorator's own name.
    const results = await Promise.all(checks);
    return results.every(Boolean);
  }

  /** RequireAnyOf: OR across both namespaces — tries roles first, then permissions. */
  private async checkAnyOf(
    internalUserId: string,
    values: string[],
  ): Promise<boolean> {
    if (await this.accessControlService.hasAnyRole(internalUserId, values)) {
      return true;
    }
    return this.accessControlService.hasAnyPermission(internalUserId, values);
  }
}
