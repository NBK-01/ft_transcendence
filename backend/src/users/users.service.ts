import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDto } from './dto/user.dto';
import { UserFactory } from './factories/user.factory';
import { CryptoService } from '../common/services/crypto.service';
import { UserNotFoundException } from './exceptions';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const hashedPassword = await this.cryptoService.hashPassword(dto.password);
    const user = this.userRepository.create({
      ...dto,
      password: hashedPassword,
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
    return UserFactory.toDtoArray(await this.userRepository.find());
  }

  async getProfile(userId: string): Promise<UserDto> {
    const user = await this.findById(userId);
    if (!user) {
      throw new UserNotFoundException(userId);
    }
    return UserFactory.toDto(user);
  }

  async verifyUser(userId: string): Promise<void> {
    await this.userRepository.update(userId, { isVerified: true });
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
