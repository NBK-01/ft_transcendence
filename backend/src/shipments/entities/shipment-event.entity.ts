import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ShipmentActorType } from '../constants/shipment-actor';
import { ShipmentState } from '../constants/shipment-state';
import { Shipment } from './shipment.entity';

/** One step of a shipment's timeline, written on every status change. createdAt is when it happened. */
@Entity('shipment_event')
export class ShipmentEvent extends BaseEntity {
  @Index()
  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId!: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.events, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shipment_id' })
  shipment?: Shipment;

  @Column({ type: 'enum', enum: ShipmentState })
  status!: ShipmentState;

  /** Where it happened or what happened, e.g. "Lyon hub" or "Offer approved". */
  @Column()
  location!: string;

  /** Who wrote it (see ShipmentActor). Null on events from before it was recorded. */
  @Column({
    name: 'actor_type',
    type: 'enum',
    enum: ShipmentActorType,
    nullable: true,
  })
  actorType!: ShipmentActorType | null;

  /**
   * A User, InternalUser or ApiKey id, depending on actorType; null for the
   * carrier. No foreign key: it points at a different table per type.
   */
  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId!: string | null;
}
