import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { Organization } from './organization.entity';
import { InternalUser } from '../internal-users/internal-user.entity';
import { InternalUserNotFoundException } from '../internal-users/exceptions';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ApiKey } from '../public-api/entities/api-key.entity';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationDto } from './dto/organization.dto';
import { OrganizationFactory } from './factories/organization.factory';
import { InternalUsersService } from '../internal-users/internal-users.service';
import { ActionSignals } from '../notifications/action-signals';
import {
  OrganizationNotFoundException,
  OrganizationAlreadyExistsException,
  OrganizationInUseException,
  StaffNotInOrganizationException,
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
    if (dto.name !== undefined && dto.name !== org.name) {
      const taken = await this.organizationRepository.findOne({
        where: { name: dto.name },
      });
      if (taken) {
        throw new OrganizationAlreadyExistsException(dto.name);
      }
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

  /**
   * Deletes a branch nothing points at any more: no staff, shipments or API
   * keys (which would go with it). Anything else is a 409: deactivate it
   * instead (PATCH isActive false), which keeps its history.
   */
  async remove(id: string): Promise<void> {
    const org = await this.findById(id);
    await this.organizationRepository.manager.transaction(async (manager) => {
      const where = { organizationId: id };
      const [staff, shipments, apiKeys] = await Promise.all([
        manager.count(InternalUser, { where }),
        manager.count(Shipment, { where }),
        manager.count(ApiKey, { where }),
      ]);
      if (staff + shipments + apiKeys > 0) {
        throw new OrganizationInUseException(org.name);
      }
      await manager.delete(Organization, id);
    });
    this.eventEmitter.emit(ActionSignals.ORGANIZATION_DELETED, {
      organizationId: id,
      name: org.name,
    });
  }

  /**
   * Puts a staff member in this branch. Assigning them where they already
   * are changes nothing; moving them from another branch also tells them
   * they left it.
   */
  async assignStaff(
    organizationId: string,
    internalUserId: string,
  ): Promise<void> {
    await this.findById(organizationId);
    const staff = await this.internalUsersService.findById(internalUserId);
    if (!staff) {
      throw new InternalUserNotFoundException(internalUserId);
    }
    if (staff.organizationId === organizationId) {
      return;
    }
    await this.internalUsersService.setOrganization(
      internalUserId,
      organizationId,
    );
    if (staff.organizationId) {
      this.eventEmitter.emit(ActionSignals.ORGANIZATION_STAFF_REMOVED, {
        organizationId: staff.organizationId,
        internalUserId,
      });
    }
    this.eventEmitter.emit(ActionSignals.ORGANIZATION_STAFF_ADDED, {
      organizationId,
      internalUserId,
    });
  }

  /** Takes a staff member out of this branch: 404 (4004) when they aren't in it. */
  async removeStaff(
    organizationId: string,
    internalUserId: string,
  ): Promise<void> {
    await this.findById(organizationId);
    const staff = await this.internalUsersService.findById(internalUserId);
    if (!staff) {
      throw new InternalUserNotFoundException(internalUserId);
    }
    if (staff.organizationId !== organizationId) {
      throw new StaffNotInOrganizationException(internalUserId);
    }
    await this.internalUsersService.setOrganization(internalUserId, null);
    this.eventEmitter.emit(ActionSignals.ORGANIZATION_STAFF_REMOVED, {
      organizationId,
      internalUserId,
    });
  }

  async listStaff(organizationId: string) {
    await this.findById(organizationId);
    return this.internalUsersService.findByOrganization(organizationId);
  }
}
