import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
  CannotRemoveLastAdminException,
} from './exceptions';
import { RoleNotFoundException } from '../access-control/exceptions';
import { AccountType } from '../common/context/auth-context.types';
import { ActionSignals } from '../notifications/action-signals';
import { ProfileChange } from '../notifications/constants/notification.constants';

const ADMIN_ROLE_NAME = 'admin';

@Injectable()
export class InternalUsersService {
  constructor(
    @InjectRepository(InternalUser)
    private readonly internalUserRepository: Repository<InternalUser>,
    @InjectRepository(Role) private readonly roleRepository: Repository<Role>,
    private readonly cryptoService: CryptoService,
    private readonly eventEmitter: EventEmitter2,
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
      // Stored the way findByEmail() searches, or a mixed-case email could never sign in.
      email: dto.email.toLowerCase().trim(),
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

  /**
   * A staff member renames themselves (PATCH /staff-profile): a record for
   * them, nobody else told. An admin renaming someone goes through update().
   */
  async renameSelf(id: string, name: string): Promise<void> {
    const staff = await this.findById(id);
    if (!staff) {
      throw new InternalUserNotFoundException(id);
    }
    if (staff.name === name) {
      return;
    }
    await this.internalUserRepository.update(id, { name });
    this.signalProfileUpdated(id, 'details');
  }

  /**
   * Sets (or, with null, clears) the staff member's own photo. Returns the
   * key it replaced, for the caller to delete from storage.
   */
  async setAvatar(
    id: string,
    avatarKey: string | null,
  ): Promise<{ previousKey: string | null }> {
    const staff = await this.findById(id);
    if (!staff) {
      throw new InternalUserNotFoundException(id);
    }
    const previousKey = staff.avatarKey ?? null;
    if (previousKey === avatarKey) {
      return { previousKey: null };
    }
    await this.internalUserRepository.update(id, { avatarKey });
    this.signalProfileUpdated(id, 'avatar');
    return { previousKey };
  }

  private signalProfileUpdated(id: string, change: ProfileChange): void {
    this.eventEmitter.emit(ActionSignals.PROFILE_UPDATED, {
      accountType: AccountType.STAFF,
      accountId: id,
      change,
    });
  }

  /** With the role and the branch, for GET /staff-auth/me. */
  async findWithBranch(id: string): Promise<InternalUser | null> {
    return this.internalUserRepository.findOne({
      where: { id },
      relations: ['role', 'organization'],
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

    let role: Role | undefined;
    if (dto.roleName) {
      role =
        (await this.roleRepository.findOne({
          where: { name: dto.roleName },
        })) ?? undefined;
      if (!role) {
        throw new RoleNotFoundException(dto.roleName);
      }
    }

    await this.assertNotRemovingLastActiveAdmin(user, dto, role);

    if (role) {
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

  /**
   * Guards against deactivating or demoting the last active admin — only
   * relevant when `user` currently IS an active admin and this update would
   * take that status away (an unrelated change, like organizationId, is
   * left alone even on the last admin).
   */
  private async assertNotRemovingLastActiveAdmin(
    user: InternalUser,
    dto: UpdateInternalUserDto,
    newRole: Role | undefined,
  ): Promise<void> {
    const isActiveAdmin = user.role?.name === ADMIN_ROLE_NAME && user.isActive;
    if (!isActiveAdmin) {
      return;
    }
    const losesAdminStatus =
      dto.isActive === false ||
      (newRole !== undefined && newRole.name !== ADMIN_ROLE_NAME);
    if (!losesAdminStatus) {
      return;
    }
    const otherActiveAdmins = await this.internalUserRepository.find({
      // isActiveAdmin being true guarantees roleId is set (the role relation loaded above).
      where: { roleId: user.roleId as string, isActive: true },
    });
    if (otherActiveAdmins.every((admin) => admin.id === user.id)) {
      throw new CannotRemoveLastAdminException(user.id);
    }
  }

  /**
   * Permanent removal, distinct from deactivate (PATCH isActive: false) — the
   * row is gone, not just locked out. Refuses the last active admin, same
   * invariant and error (8007) as demoting/deactivating one.
   */
  async delete(id: string): Promise<void> {
    const user = await this.internalUserRepository.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!user) {
      throw new InternalUserNotFoundException(id);
    }
    if (user.role?.name === ADMIN_ROLE_NAME && user.isActive) {
      const otherActiveAdmins = await this.internalUserRepository.find({
        where: { roleId: user.roleId as string, isActive: true },
      });
      if (otherActiveAdmins.every((admin) => admin.id === user.id)) {
        throw new CannotRemoveLastAdminException(user.id);
      }
    }
    await this.internalUserRepository.remove(user);
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
    this.eventEmitter.emit(ActionSignals.PASSWORD_CHANGED, {
      accountType: AccountType.STAFF,
      accountId: id,
    });
  }

  async hashPassword(password: string): Promise<string> {
    return this.cryptoService.hashPassword(password);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return this.cryptoService.comparePassword(password, hash);
  }
}
