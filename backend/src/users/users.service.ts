import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthProvider, User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { UserFactory } from './factories/user.factory';
import { CryptoService } from '../common/services/crypto.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { UserNotFoundException } from './exceptions';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly cryptoService: CryptoService,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await this.cryptoService.hashPassword(dto.password);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });
    return this.userRepository.save(user);
  }

  /** Google's email is pre-verified — skip the OTP flow, no password to set. */
  async createOAuthUser(data: { email: string; name: string }): Promise<User> {
    const user = this.userRepository.create({
      email: data.email,
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

  async updatePasswordHash(
    userId: string,
    hashedPassword: string,
  ): Promise<void> {
    await this.userRepository.update(userId, { password: hashedPassword });
  }

  async hashPassword(password: string): Promise<string> {
    return this.cryptoService.hashPassword(password);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.cryptoService.comparePassword(password, hash);
  }
}
