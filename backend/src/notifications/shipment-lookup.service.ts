import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountType } from '../common/context/auth-context.types';
import { ShipmentState } from '../shipments/constants/shipment-state';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { InternalUser } from '../internal-users/internal-user.entity';
import { RolePermission } from '../access-control/entities/role-permission.entity';
import { NotificationRecipient } from './notifications.service';

/** The permission behind the admin shipments list (AdminShipmentsController): staff holding it see every shipment. */
export const SHIPMENTS_READ_ALL_PERMISSION = 'shipments:read:all';

/** What a shipment notification needs to know about the event that triggered it. */
export interface ShipmentEventSummary {
  id: string;
  status: ShipmentState;
  trackingId: string;
  /** The shipment's customer (a User id). */
  clientId: string;
}

/** Read-only lookups for the shipment notification job: the event, and the staff to tell about it. */
@Injectable()
export class ShipmentLookupService {
  constructor(
    @InjectRepository(ShipmentEvent)
    private readonly eventRepository: Repository<ShipmentEvent>,
    @InjectRepository(InternalUser)
    private readonly internalUserRepository: Repository<InternalUser>,
  ) {}

  /** Null when the event is gone (it's deleted along with its shipment). */
  async findEvent(id: string): Promise<ShipmentEventSummary | null> {
    const event = await this.eventRepository.findOne({
      where: { id },
      relations: { shipment: true },
    });
    if (!event?.shipment) {
      return null;
    }
    return {
      id: event.id,
      status: event.status,
      trackingId: event.shipment.trackingId,
      clientId: event.shipment.clientId,
    };
  }

  /**
   * Active staff whose role grants shipments:read:all (admin and support
   * today). Read from the role → permission table rather than a list of
   * role names, so a role that gains or loses the permission follows.
   */
  async findShipmentStaff(): Promise<NotificationRecipient[]> {
    const rows = await this.internalUserRepository
      .createQueryBuilder('staff')
      .innerJoin(
        RolePermission,
        'rolePermission',
        'rolePermission.roleId = staff.roleId',
      )
      .innerJoin('rolePermission.permission', 'permission')
      .where('staff.isActive = :active', { active: true })
      .andWhere('permission.name = :permission', {
        permission: SHIPMENTS_READ_ALL_PERMISSION,
      })
      .select('staff.id', 'id')
      .getRawMany<{ id: string }>();
    return rows.map(({ id }) => ({ id, accountType: AccountType.STAFF }));
  }
}
