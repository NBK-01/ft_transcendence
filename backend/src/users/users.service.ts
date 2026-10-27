import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { AuthProvider, User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserDto } from './dto/user.dto';
import { UserFactory } from './factories/user.factory';
import { CryptoService } from '../common/services/crypto.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { UserNotFoundException } from './exceptions';
import { AccountType } from '../common/context/auth-context.types';
import { ActionSignals } from '../notifications/action-signals';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly cryptoService: CryptoService,
    private readonly fileStorageService: FileStorageService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await this.cryptoService.hashPassword(dto.password);
    const user = this.userRepository.create({
      ...dto,
      // Stored the way findByEmail() searches, or a mixed-case email could never sign in.
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  /** Google's email is pre-verified — skip the OTP flow, no password to set. */
  async createOAuthUser(data: { email: string; name: string }): Promise<User> {
    const user = this.userRepository.create({
      email: data.email.toLowerCase().trim(),
      name: data.name,
      password: null,
      isVerified: true,
      authProvider: AuthProvider.GOOGLE,
    });
    return this.userRepository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async findAll(): Promise<UserDto[]> {
    const users = await this.userRepository.find();
    const entries = await Promise.all(
      users.map(async (user) => ({
        user,
        avatarUrl: await this.resolveAvatarUrl(user.avatarKey),
      })),
    );
    return UserFactory.toDtoArray(entries);
  }

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }
    const avatarUrl = await this.resolveAvatarUrl(user.avatarKey);
    return UserFactory.toDto(user, avatarUrl);
  }

  /**
   * `name` has no separate first/last columns of its own — it's re-derived
   * from firstName+lastName on every update so nav/auth responses (which
   * still read `name`) stay in sync without migrating every reference.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }

    const firstName = dto.firstName ?? user.firstName;
    const lastName = dto.lastName ?? user.lastName;
    const dateOfBirth =
      dto.dateOfBirth !== undefined ? dto.dateOfBirth : user.dateOfBirth;
    const phoneNumber =
      dto.phoneNumber !== undefined ? dto.phoneNumber : user.phoneNumber;

    await this.userRepository.update(userId, {
      firstName,
      lastName,
      dateOfBirth,
      phoneNumber,
      name: `${firstName ?? ''} ${lastName ?? ''}`.trim(),
    });

    const updated = await this.findById(userId);
    const avatarUrl = await this.resolveAvatarUrl(updated?.avatarKey);
    return UserFactory.toDto(updated as User, avatarUrl);
  }

  private async resolveAvatarUrl(
    avatarKey: string | null | undefined,
  ): Promise<string | null> {
    if (!avatarKey) {
      return null;
    }
    return this.fileStorageService.getAvatarUrl(avatarKey);
  }

  async verifyUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isVerified: true });
  }

  /**
   * Self-deactivation, not a hard delete — matches how Organization/InternalUser
   * are "removed" elsewhere. forceLogoutAfter is set here so a session someone
   * forgot to revoke also dies; the caller still separately revokes every
   * refresh token it has a record of (see AuthService.deactivateAccount).
   */
  async deactivate(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      isActive: false,
      forceLogoutAfter: new Date(),
    });
  }

  /** Returns the previous avatarKey (if any) so the caller can delete the now-orphaned storage object. */
  async updateAvatar(
    userId: string,
    avatar: { key: string },
  ): Promise<{ previousKey: string | null }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }
    const previousKey = user.avatarKey ?? null;
    await this.userRepository.update(userId, { avatarKey: avatar.key });
    return { previousKey };
  }

  /**
   * Clears the avatar, if any. Idempotent — calling it with no avatar set is
   * just a no-op, not an error. Returns the removed key (if any) so the
   * caller can best-effort delete the now-orphaned storage object.
   */
  async removeAvatar(userId: string): Promise<{ previousKey: string | null }> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }
    const previousKey = user.avatarKey ?? null;
    if (previousKey) {
      await this.userRepository.update(userId, { avatarKey: null });
    }
    return { previousKey };
  }

  async updatePasswordHash(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await this.userRepository.update(userId, { password: hashedPassword });
    this.eventEmitter.emit(ActionSignals.PASSWORD_CHANGED, {
      accountType: AccountType.CUSTOMER,
      accountId: userId,
    });
  }

  async hashPassword(password: string): Promise<string> {
    return this.cryptoService.hashPassword(password);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.cryptoService.comparePassword(password, hash);
  }
}
