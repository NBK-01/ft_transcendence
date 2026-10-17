import { User } from '../user.entity';
import { UserDto } from '../dto/user.dto';

export class UserFactory {
  /** avatarUrl is a freshly-signed URL resolved by the caller — never read from a stored column. */
  static toDto(user: User, avatarUrl: string | null = null): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isVerified: user.isVerified,
      avatarUrl,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toDtoArray(
    entries: Array<{ user: User; avatarUrl: string | null }>,
  ): UserDto[] {
    return entries.map(({ user, avatarUrl }) => this.toDto(user, avatarUrl));
  }
}
