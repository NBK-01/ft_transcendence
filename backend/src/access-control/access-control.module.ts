import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RolePermission } from './entities/role-permission.entity';
import { InternalUser } from '../internal-users/internal-user.entity';
import { AccessControlService } from './access-control.service';
import { AccessControlController } from './access-control.controller';
import { AccessControlGuard } from './guards/access-control.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, Permission, RolePermission, InternalUser]),
  ],
  controllers: [AccessControlController],
  providers: [AccessControlService, AccessControlGuard],
  exports: [AccessControlService, AccessControlGuard],
})
export class AccessControlModule {}
