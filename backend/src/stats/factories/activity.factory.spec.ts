import { Organization } from '../../organizations/organization.entity';
import { ApiKey } from '../../public-api/entities/api-key.entity';
import { ShipmentActorType } from '../../shipments/constants/shipment-actor';
import { ShipmentState } from '../../shipments/constants/shipment-state';
import { Shipment } from '../../shipments/entities/shipment.entity';
import { ShipmentEvent } from '../../shipments/entities/shipment-event.entity';
import { ActivityFactory, ActorDirectory } from './activity.factory';

const BRANCH = Object.assign(new Organization(), {
  id: 'org-1',
  name: 'Beirut Central',
});
const KEY = Object.assign(new ApiKey(), {
  id: 'key-1',
  name: 'Warehouse system',
  organization: BRANCH,
});
const DIRECTORY: ActorDirectory = {
  customers: new Map([['user-1', 'Amina El Idrissi']]),
  staff: new Map([['staff-1', 'Nadia Haddad']]),
  apiKeys: new Map([['key-1', KEY]]),
};
const OCCURRED_AT = new Date('2026-10-26T09:30:00Z');

function event(
  actorType: ShipmentActorType | null,
  actorId: string | null,
): ShipmentEvent {
  return Object.assign(new ShipmentEvent(), {
    id: 'event-1',
    shipment: Object.assign(new Shipment(), { trackingId: 'TRK-4A6F90' }),
    status: ShipmentState.IN_TRANSIT,
    location: 'Lyon hub',
    createdAt: OCCURRED_AT,
    actorType,
    actorId,
  });
}

const actorOf = (actorType: ShipmentActorType | null, actorId: string | null) =>
  ActivityFactory.toDto(event(actorType, actorId), DIRECTORY).actor;

describe('ActivityFactory', () => {
  it('is the event, its tracking ID and when it happened', () => {
    expect(
      ActivityFactory.toDto(
        event(ShipmentActorType.STAFF, 'staff-1'),
        DIRECTORY,
      ),
    ).toEqual({
      id: 'event-1',
      trackingId: 'TRK-4A6F90',
      status: ShipmentState.IN_TRANSIT,
      location: 'Lyon hub',
      occurredAt: OCCURRED_AT,
      actor: {
        type: ShipmentActorType.STAFF,
        id: 'staff-1',
        name: 'Nadia Haddad',
        organization: null,
      },
    });
  });

  it('names a customer, and a partner by its key and branch', () => {
    expect(actorOf(ShipmentActorType.CUSTOMER, 'user-1')).toEqual({
      type: ShipmentActorType.CUSTOMER,
      id: 'user-1',
      name: 'Amina El Idrissi',
      organization: null,
    });
    expect(actorOf(ShipmentActorType.PARTNER, 'key-1')).toEqual({
      type: ShipmentActorType.PARTNER,
      id: 'key-1',
      name: 'Warehouse system',
      organization: { id: 'org-1', name: 'Beirut Central' },
    });
  });

  it('has no name for the carrier, or for an account that is gone', () => {
    expect(actorOf(ShipmentActorType.CARRIER, null)).toEqual({
      type: ShipmentActorType.CARRIER,
      id: null,
      name: null,
      organization: null,
    });
    expect(actorOf(ShipmentActorType.STAFF, 'staff-gone')).toMatchObject({
      id: 'staff-gone',
      name: null,
    });
    expect(actorOf(ShipmentActorType.PARTNER, 'key-gone')).toMatchObject({
      name: null,
      organization: null,
    });
  });

  it('has no actor for an event from before it was recorded', () => {
    expect(actorOf(null, null)).toBeNull();
  });
});
