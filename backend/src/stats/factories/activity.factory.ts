import { ApiKey } from '../../public-api/entities/api-key.entity';
import { ShipmentActorType } from '../../shipments/constants/shipment-actor';
import { ShipmentEvent } from '../../shipments/entities/shipment-event.entity';
import { ActivityActorDto, ActivityDto } from '../dto/overview-stats.dto';

/** Names for the actors of a batch of events, by id (StatsService.actorDirectory). */
export interface ActorDirectory {
  customers: ReadonlyMap<string, string>;
  staff: ReadonlyMap<string, string>;
  /** With their organization loaded. */
  apiKeys: ReadonlyMap<string, ApiKey>;
}

export class ActivityFactory {
  /** Needs the event's shipment loaded (its trackingId at least). */
  static toDto(event: ShipmentEvent, directory: ActorDirectory): ActivityDto {
    return {
      id: event.id,
      trackingId: event.shipment!.trackingId,
      status: event.status,
      location: event.location,
      occurredAt: event.createdAt,
      actor: this.toActor(event, directory),
    };
  }

  private static toActor(
    { actorType, actorId }: ShipmentEvent,
    directory: ActorDirectory,
  ): ActivityActorDto | null {
    if (!actorType) {
      return null;
    }
    const actor = { type: actorType, id: actorId, organization: null };
    if (!actorId) {
      return { ...actor, name: null };
    }
    switch (actorType) {
      case ShipmentActorType.CUSTOMER:
        return { ...actor, name: directory.customers.get(actorId) ?? null };
      case ShipmentActorType.STAFF:
        return { ...actor, name: directory.staff.get(actorId) ?? null };
      case ShipmentActorType.PARTNER: {
        const key = directory.apiKeys.get(actorId);
        const branch = key?.organization;
        return {
          ...actor,
          name: key?.name ?? null,
          organization: branch ? { id: branch.id, name: branch.name } : null,
        };
      }
      default:
        return { ...actor, name: null };
    }
  }
}
