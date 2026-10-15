import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InternalUser } from './internal-user.entity';
import { Role } from '../access-control/entities/role.entity';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { UpdateInternalUserDto } from './dto/update-internal-user.dto';
import { InternalUserDto } from './dto/internal-user.dto';
import { InternalUserFactory } from './factories/internal-user.factory';
import { CryptoService } from '../common/services/crypto.service';
import {
  InternalUserNotFoundException,
  InternalUserAlreadyExistsException,
} from './exceptions';
import { RoleNotFoundException } from '../access-control/exceptions';

@Injectable()
export class InternalUsersService {
  constructor(
    @InjectRepository(InternalUser)
    private readonly internalUserRepository: Repository<InternalUser>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(dto: CreateInternalUserDto): Promise<InternalUser> {
    const existing = await this.findByEmail(dto.email);
    if (existing) {
      throw new InternalUserAlreadyExistsException(dto.email);
    }

    const role = await this.roleRepository.findOne({
      where: { name: dto.roleName },
    });
    if (!role) {
      throw new RoleNotFoundException(dto.roleName);
    }

    const hashedPassword = await this.cryptoService.hashPassword(dto.password);
    const user = this.internalUserRepository.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      roleId: role.id,
      organizationId: dto.organizationId ?? null,
    });
    const saved = await this.internalUserRepository.save(user);
    saved.role = role;
    return saved;
  }

  async findById(id: string): Promise<InternalUser | null> {
    return this.internalUserRepository.findOne({
      where: { id },
      relations: ['role'],
    });
  }

  async findByEmail(email: string): Promise<InternalUser | null> {
    return this.internalUserRepository.findOne({
      where: { email: email.toLowerCase().trim() },
      relations: ['role'],
    });
  }

  async findAll(): Promise<InternalUserDto[]> {
    const users = await this.internalUserRepository.find({
      relations: ['role'],
    });
    return InternalUserFactory.toDtoArray(users);
  }

  async getProfile(id: string): Promise<InternalUserDto> {
    const user = await this.findById(id);
    if (!user) {
      throw new InternalUserNotFoundException(id);
    }
    return InternalUserFactory.toDto(user);
  }

  async update(id: string, dto: UpdateInternalUserDto): Promise<InternalUser> {
    const user = await this.internalUserRepository.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!user) {
      throw new InternalUserNotFoundException(id);
    }

    if (dto.roleName) {
      const role = await this.roleRepository.findOne({
        where: { name: dto.roleName },
      });
      if (!role) {
        throw new RoleNotFoundException(dto.roleName);
      }
      user.roleId = role.id;
      user.role = role;
    }
    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    if (dto.organizationId !== undefined) {
      user.organizationId = dto.organizationId;
    }
    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }

    return this.internalUserRepository.save(user);
  }

  async setOrganization(
    id: string,
    organizationId: string | null,
  ): Promise<void> {
    const result = await this.internalUserRepository.update(id, {
      organizationId,
    });
    if (result.affected === 0) {
      throw new InternalUserNotFoundException(id);
    }
  }

  async findByOrganization(organizationId: string): Promise<InternalUserDto[]> {
    const users = await this.internalUserRepository.find({
      where: { organizationId },
      relations: ['role'],
    });
    return InternalUserFactory.toDtoArray(users);
  }

  async updatePasswordHash(id: string, hashedPassword: string): Promise<void> {
    await this.internalUserRepository.update(id, { password: hashedPassword });
  }

  async hashPassword(password: string): Promise<string> {
    return this.cryptoService.hashPassword(password);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.cryptoService.comparePassword(password, hash);
  }
}
