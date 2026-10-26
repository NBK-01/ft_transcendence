import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import {
  ShipmentState,
  TRACKING_TRANSITIONS,
} from '../shipments/constants/shipment-state';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { ShipmentNotFoundException } from '../shipments/exceptions';
import { ListShipmentsQueryDto } from '../shipments/dto/list-shipments-query.dto';
import { ShipmentsService } from '../shipments/shipments.service';
import { User } from '../users/user.entity';
import { PartnerContext } from './types/partner-context';
import { CreatePartnerShipmentDto } from './dto/create-partner-shipment.dto';
import { UpdatePartnerShipmentStatusDto } from './dto/update-partner-shipment-status.dto';
import {
  PartnerShipmentDetailDto,
  PartnerShipmentDto,
} from './dto/partner-shipment.dto';
import {
  PartnerShipmentFactory,
  ShipmentWithClient,
} from './factories/partner-shipment.factory';
import { PartnerCustomerNotFoundException } from './exceptions';

/**
 * The shipments a partner reaches with its API key: only its branch's.
 * Another branch's shipment, or a client request no branch holds, is a 404,
 * so a key never learns that a tracking ID exists.
 *
 * Status changes go through ShipmentsService.transition, the same path as
 * the admin's, so the allowed moves, the 409 on a race and the timeline
 * step (and with it the customer's notification) are the same.
 */
@Injectable()
export class PartnerShipmentsService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    // Only read: the customer a new shipment is for.
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly shipmentsService: ShipmentsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Most recently updated first, like the admin list. */
  async list(
    partner: PartnerContext,
    query: ListShipmentsQueryDto,
  ): Promise<PaginatedResponseDto<PartnerShipmentDto>> {
    const qb = this.shipmentRepository
      .createQueryBuilder('shipment')
      .innerJoinAndSelect('shipment.client', 'client')
      .where('shipment.organizationId = :organizationId', {
        organizationId: partner.organizationId,
      });
    const q = query.q?.trim();
    if (q) {
      qb.andWhere('shipment.trackingId ILIKE :q', {
        q: `%${q.replace(/[\\%_]/g, '\\$&')}%`,
      });
    }
    if (query.status) {
      qb.andWhere('shipment.status = :status', { status: query.status });
    }
    const [rows, total] = await qb
      .orderBy('shipment.updatedAt', 'DESC')
      .addOrderBy('shipment.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return PaginatedResponseDto.create(
      (rows as ShipmentWithClient[]).map((shipment) =>
        PartnerShipmentFactory.toDto(shipment),
      ),
      total,
      query.page,
      query.limit,
    );
  }

  async get(
    partner: PartnerContext,
    trackingId: string,
  ): Promise<PartnerShipmentDetailDto> {
    const shipment = await this.findForPartner(partner, trackingId);
    const events = await this.shipmentsService.listEvents(shipment.trackingId);
    return PartnerShipmentFactory.toDetail(shipment, events);
  }

  /**
   * The branch already has the parcel: it starts at `confirmed`, with its
   * route set, and the customer sees it in their account (and is notified).
   */
  async create(
    partner: PartnerContext,
    dto: CreatePartnerShipmentDto,
  ): Promise<PartnerShipmentDetailDto> {
    const email = dto.customerEmail.trim().toLowerCase();
    const customer = await this.userRepository.findOne({ where: { email } });
    if (!customer?.isActive) {
      throw new PartnerCustomerNotFoundException();
    }
    const sender = { ...dto.sender, city: dto.sender.city.trim() };
    const recipient = { ...dto.recipient, city: dto.recipient.city.trim() };

    const trackingId = await this.shipmentsService.generateTrackingId();
    await this.dataSource.transaction(async (manager) => {
      const shipment = await manager.save(
        manager.create(Shipment, {
          trackingId,
          clientId: customer.id,
          organizationId: partner.organizationId,
          status: ShipmentState.CONFIRMED,
          productUrl: null,
          sender,
          recipient,
          origin: sender.city,
          destination: recipient.city,
          weightKg: dto.weightKg,
        }),
      );
      await manager.insert(ShipmentEvent, {
        shipmentId: shipment.id,
        status: ShipmentState.CONFIRMED,
        location: `Created by ${partner.organizationName}`,
      });
    });
    return this.get(partner, trackingId);
  }

  /** A tracking update: only the moves TRACKING_TRANSITIONS allows from the current status, else 409 (3002). */
  async updateStatus(
    partner: PartnerContext,
    trackingId: string,
    dto: UpdatePartnerShipmentStatusDto,
  ): Promise<PartnerShipmentDetailDto> {
    const shipment = await this.findForPartner(partner, trackingId);
    await this.dataSource.transaction((manager) =>
      this.shipmentsService.transition(manager, shipment, {
        from: TRACKING_TRANSITIONS[dto.status] ?? [],
        to: dto.status,
        location: dto.location.trim(),
      }),
    );
    return this.get(partner, trackingId);
  }

  /** Cancels it, from any status that isn't final; the shipment and its history stay. */
  async cancel(
    partner: PartnerContext,
    trackingId: string,
    reason?: string,
  ): Promise<PartnerShipmentDetailDto> {
    const shipment = await this.findForPartner(partner, trackingId);
    await this.dataSource.transaction((manager) =>
      this.shipmentsService.transition(manager, shipment, {
        from: TRACKING_TRANSITIONS[ShipmentState.CANCELLED] ?? [],
        to: ShipmentState.CANCELLED,
        location: reason?.trim() || `Cancelled by ${partner.organizationName}`,
      }),
    );
    return this.get(partner, trackingId);
  }

  private async findForPartner(
    partner: PartnerContext,
    trackingId: string,
  ): Promise<ShipmentWithClient> {
    const shipment = await this.shipmentRepository.findOne({
      where: {
        trackingId: trackingId.trim().toUpperCase(),
        organizationId: partner.organizationId,
      },
      relations: { client: true },
    });
    if (!shipment) {
      throw new ShipmentNotFoundException(trackingId);
    }
    return shipment as ShipmentWithClient;
  }
}
