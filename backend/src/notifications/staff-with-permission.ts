import { Repository } from 'typeorm';
import { AccountType } from '../common/context/auth-context.types';
import { InternalUser } from '../internal-users/internal-user.entity';
import { RolePermission } from '../access-control/entities/role-permission.entity';
import { NotificationRecipient } from './notifications.service';

/**
 * Active staff whose role grants `permission`. Read from the role →
 * permission table rather than a list of role names, so a role that gains or
 * loses the permission follows.
 */
export async function findActiveStaffWithPermission(
  internalUserRepository: Repository<InternalUser>,
  permission: string,
): Promise<NotificationRecipient[]> {
  const rows = await internalUserRepository
    .createQueryBuilder('staff')
    .innerJoin(
      RolePermission,
      'rolePermission',
      'rolePermission.roleId = staff.roleId',
    )
    .innerJoin('rolePermission.permission', 'permission')
    .where('staff.isActive = :active', { active: true })
    .andWhere('permission.name = :permission', { permission })
    .select('staff.id', 'id')
    .getRawMany<{ id: string }>();
  return rows.map(({ id }) => ({ id, accountType: AccountType.STAFF }));
}
