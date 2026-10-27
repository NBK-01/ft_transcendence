import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { ShipmentActorType } from '../shipments/constants/shipment-actor';
import { ShipmentState } from '../shipments/constants/shipment-state';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { InternalUser } from '../internal-users/internal-user.entity';
import { NotificationRecipient } from './notifications.service';
import { findActiveStaffWithPermission } from './staff-with-permission';

/** The permission behind the admin shipments list (AdminShipmentsController): staff holding it see every shipment. */
export const SHIPMENTS_READ_ALL_PERMISSION = 'shipments:read:all';

/** What a shipment notification needs to know about the event that triggered it. */
export interface ShipmentEventSummary {
  id: string;
  status: ShipmentState;
  trackingId: string;
  /** The shipment's customer (a User id). */
  clientId: string;
  /**
   * The shipment's first timeline step. A shipment that starts at
   * `confirmed` was created by a partner (public API), so its customer is
   * told about a new shipment, not a confirmed payment.
   */
  isFirstEvent: boolean;
  /** Who wrote it; null on events from before it was recorded. */
  actorType: ShipmentActorType | null;
  /** A User id (customer), InternalUser id (staff) or ApiKey id (partner); null for the carrier and older events. */
  actorId: string | null;
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
    const hasEarlierEvent = await this.eventRepository.exists({
      where: {
        shipmentId: event.shipmentId,
        createdAt: LessThan(event.createdAt),
      },
    });
    return {
      id: event.id,
      status: event.status,
      trackingId: event.shipment.trackingId,
      clientId: event.shipment.clientId,
      isFirstEvent: !hasEarlierEvent,
      actorType: event.actorType,
      actorId: event.actorId,
    };
  }

  /** Active staff whose role grants shipments:read:all (admin and support today). */
  findShipmentStaff(): Promise<NotificationRecipient[]> {
    return findActiveStaffWithPermission(
      this.internalUserRepository,
      SHIPMENTS_READ_ALL_PERMISSION,
    );
  }
}
