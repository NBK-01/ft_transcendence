/** Who wrote a shipment event: which side of the platform moved the shipment. */
export enum ShipmentActorType {
  /** The shipment's client, in the client app (request, offer decision, payment). */
  CUSTOMER = 'customer',
  /** A staff member, in the admin app (offer, payment confirmation, tracking). */
  STAFF = 'staff',
  /** A branch's system, through the public API with one of its keys. */
  PARTNER = 'partner',
  /** The carrier, through its signed webhook. */
  CARRIER = 'carrier',
}

/**
 * Stored on every shipment event. `id` is a User id (customer), an
 * InternalUser id (staff) or an ApiKey id (partner); the carrier has none.
 */
export type ShipmentActor =
  | {
      type:
        | ShipmentActorType.CUSTOMER
        | ShipmentActorType.STAFF
        | ShipmentActorType.PARTNER;
      id: string;
    }
  | { type: ShipmentActorType.CARRIER; id: null };

export const customerActor = (userId: string): ShipmentActor => ({
  type: ShipmentActorType.CUSTOMER,
  id: userId,
});

export const staffActor = (internalUserId: string): ShipmentActor => ({
  type: ShipmentActorType.STAFF,
  id: internalUserId,
});

export const partnerActor = (apiKeyId: string): ShipmentActor => ({
  type: ShipmentActorType.PARTNER,
  id: apiKeyId,
});

export const CARRIER_ACTOR: ShipmentActor = {
  type: ShipmentActorType.CARRIER,
  id: null,
};
