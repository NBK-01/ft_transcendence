import { InternalUser } from '../internal-user.entity';
import { InternalUserDto } from '../dto/internal-user.dto';

export class InternalUserFactory {
  static toDto(user: InternalUser): InternalUserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      roleName: user.role?.name ?? null,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toDtoArray(users: InternalUser[]): InternalUserDto[] {
    return users.map((user) => this.toDto(user));
  }
}
