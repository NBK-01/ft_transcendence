import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalUser } from '../internal-users/internal-user.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';

const ADMIN_ROLE_NAME = 'admin';

/** See AccessControlService.branchScope. */
export type BranchScope =
  { all: true } | { all: false; organizationId: string | null };

@Injectable()
export class AccessControlService {
  constructor(
    @InjectRepository(InternalUser)
    private readonly internalUserRepo: Repository<InternalUser>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
  ) {}

  async getActiveInternalUser(id: string): Promise<InternalUser | null> {
    return this.internalUserRepo.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  /**
   * Re-fetches role/permissions fresh every call rather than trusting any
   * cached claim — a role change or deactivation takes effect on the very
   * next request instead of only after the access token expires.
   */
  async getEffectivePermissions(internalUserId: string): Promise<string[]> {
    const user = await this.internalUserRepo.findOne({
      where: { id: internalUserId },
      relations: ['role'],
    });
    if (!user?.role) {
      return [];
    }
    const rolePermissions = await this.rolePermissionRepo.find({
      where: { roleId: user.role.id },
      relations: ['permission'],
    });
    return rolePermissions.map((rp) => rp.permission.name);
  }

  async getRoleName(internalUserId: string): Promise<string | null> {
    const user = await this.internalUserRepo.findOne({
      where: { id: internalUserId },
      relations: ['role'],
    });
    return user?.role?.name ?? null;
  }

  async hasPermission(
    internalUserId: string,
    permission: string,
  ): Promise<boolean> {
    return (await this.getEffectivePermissions(internalUserId)).includes(
      permission,
    );
  }

  async hasAnyPermission(
    internalUserId: string,
    permissions: string[],
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissions(internalUserId);
    return permissions.some((p) => effective.includes(p));
  }

  async hasAllPermissions(
    internalUserId: string,
    permissions: string[],
  ): Promise<boolean> {
    const effective = await this.getEffectivePermissions(internalUserId);
    return permissions.every((p) => effective.includes(p));
  }

  async hasRole(internalUserId: string, roleName: string): Promise<boolean> {
    return (await this.getRoleName(internalUserId)) === roleName;
  }

  async hasAnyRole(
    internalUserId: string,
    roleNames: string[],
  ): Promise<boolean> {
    const roleName = await this.getRoleName(internalUserId);
    return roleName !== null && roleNames.includes(roleName);
  }

  /** This project's equivalent of oori's super-admin bypass — there's no super-admin tier here, 'admin' is the top. */
  /**
   * Which shipments a staff member works on: every one (admins, and roles
   * with shipments:read:all), or only their own branch's (shipments:read:org,
   * e.g. a dispatcher). `organizationId` is null for someone in no branch:
   * they see none.
   */
  async branchScope(internalUserId: string): Promise<BranchScope> {
    if (
      (await this.isAdmin(internalUserId)) ||
      (await this.hasPermission(internalUserId, 'shipments:read:all'))
    ) {
      return { all: true };
    }
    const user = await this.internalUserRepo.findOne({
      where: { id: internalUserId },
    });
    return { all: false, organizationId: user?.organizationId ?? null };
  }

  async isAdmin(internalUserId: string): Promise<boolean> {
    return this.hasRole(internalUserId, ADMIN_ROLE_NAME);
  }

  async findRoleByName(name: string): Promise<Role | null> {
    return this.roleRepo.findOne({ where: { name } });
  }
}
