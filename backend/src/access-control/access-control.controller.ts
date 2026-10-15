import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { RequireRole } from '../common/decorators/access-control.decorator';
import { RoleNotFoundException } from './exceptions';

@ApiTags('Access Control')
@ApiBearerAuth()
@RequireRole('admin')
@Controller('access-control')
export class AccessControlController {
  constructor(
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
  ) {}

  @Get('roles')
  @ApiOperation({ summary: 'List all roles' })
  async listRoles() {
    return this.roleRepo.find();
  }

  @Get('permissions')
  @ApiOperation({ summary: 'List all permissions' })
  async listPermissions() {
    return this.permissionRepo.find();
  }

  @Get('roles/:id/permissions')
  @ApiOperation({ summary: "List a role's permissions" })
  async listRolePermissions(@Param('id') id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) {
      throw new RoleNotFoundException(id);
    }
    const rolePermissions = await this.rolePermissionRepo.find({
      where: { roleId: id },
      relations: ['permission'],
    });
    return rolePermissions.map((rp) => rp.permission);
  }
}
