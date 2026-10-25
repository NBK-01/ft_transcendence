import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationDto } from './dto/organization.dto';
import { OrganizationFactory } from './factories/organization.factory';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { ActionSignals } from '../notifications/action-signals';
import {
  OrganizationNotFoundException,
  OrganizationAlreadyExistsException,
} from './exceptions';

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly internalUsersService: InternalUsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateOrganizationDto): Promise<Organization> {
    const existing = await this.organizationRepository.findOne({
      where: { name: dto.name },
    });
    if (existing) {
      throw new OrganizationAlreadyExistsException(dto.name);
    }
    const org = this.organizationRepository.create(dto);
    return this.organizationRepository.save(org);
  }

  async findAll(): Promise<OrganizationDto[]> {
    const orgs = await this.organizationRepository.find();
    return OrganizationFactory.toDtoArray(orgs);
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.organizationRepository.findOne({ where: { id } });
    if (!org) {
      throw new OrganizationNotFoundException(id);
    }
    return org;
  }

  async getById(id: string): Promise<OrganizationDto> {
    return OrganizationFactory.toDto(await this.findById(id));
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<Organization> {
    const org = await this.findById(id);
    if (dto.name !== undefined) {
      org.name = dto.name;
    }
    if (dto.description !== undefined) {
      org.description = dto.description;
    }
    if (dto.contactEmail !== undefined) {
      org.contactEmail = dto.contactEmail;
    }
    if (dto.isActive !== undefined) {
      org.isActive = dto.isActive;
    }
    return this.organizationRepository.save(org);
  }

  /** Soft toggle, not a hard delete — InternalUser rows reference this via FK. */
  async deactivate(id: string): Promise<void> {
    await this.findById(id);
    await this.organizationRepository.update(id, { isActive: false });
    this.eventEmitter.emit(ActionSignals.ORGANIZATION_DEACTIVATED, {
      organizationId: id,
    });
  }

  async assignStaff(
    organizationId: string,
    internalUserId: string,
  ): Promise<void> {
    await this.findById(organizationId);
    await this.internalUsersService.setOrganization(
      internalUserId,
      organizationId,
    );
    this.eventEmitter.emit(ActionSignals.ORGANIZATION_STAFF_ADDED, {
      organizationId,
      internalUserId,
    });
  }

  async removeStaff(internalUserId: string): Promise<void> {
    const staff = await this.internalUsersService.findById(internalUserId);
    await this.internalUsersService.setOrganization(internalUserId, null);
    if (staff?.organizationId) {
      this.eventEmitter.emit(ActionSignals.ORGANIZATION_STAFF_REMOVED, {
        organizationId: staff.organizationId,
        internalUserId,
      });
    }
  }

  async listStaff(organizationId: string) {
    await this.findById(organizationId);
    return this.internalUsersService.findByOrganization(organizationId);
  }
}
