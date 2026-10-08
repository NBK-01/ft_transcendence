import { User } from '../user.entity';
import { UserDto } from '../dto/user.dto';

export class UserFactory {
  static toDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static toDtoArray(users: User[]): UserDto[] {
    return users.map((user) => this.toDto(user));
  }
}
