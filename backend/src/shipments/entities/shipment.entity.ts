import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/user.entity';
import { Organization } from '../../organizations/organization.entity';
import { ShipmentState } from '../constants/shipment-state';
import { numericTransformer } from './numeric.transformer';
import { ShipmentOffer } from './shipment-offer.entity';
import { ShipmentFile } from './shipment-file.entity';
import { ShipmentEvent } from './shipment-event.entity';
import { ShipmentPayment } from './shipment-payment.entity';

export interface ShipmentAddress {
  name: string;
  street: string;
  city: string;
  postalCode?: string;
  /** ISO 3166-1 alpha-2, e.g. "FR". */
  country: string;
  phone?: string;
}

/**
 * One client order, from the request (link or photos) through sourcing,
 * payment and delivery. Everything else about it lives in child tables that
 * point back here: offers, files, events (timeline) and the payment.
 */
@Entity('shipment')
export class Shipment extends BaseEntity {
  /** Public id shown to the client, e.g. "TRK-4A6F90". Always upper case. */
  @Column({ name: 'tracking_id', unique: true })
  trackingId!: string;

  @Index()
  @Column({ name: 'client_id', type: 'uuid' })
  clientId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client?: User;

  /**
   * The branch handling it. Set when a partner creates the shipment through
   * the public API (it's what scopes that partner's API key); null for a
   * client's own request, which no branch is assigned to yet.
   */
  @Index()
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId!: string | null;

  @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization | null;

  @Column({
    type: 'enum',
    enum: ShipmentState,
    default: ShipmentState.PENDING_SOURCING,
  })
  status!: ShipmentState;

  /** The product link from the request. Null when the client sent photos instead. */
  @Column({ name: 'product_url', type: 'varchar', nullable: true })
  productUrl!: string | null;

  /** Origin/destination cities and the four below are null until the admin confirms payment. */
  @Column({ type: 'varchar', nullable: true })
  origin!: string | null;

  @Column({ type: 'varchar', nullable: true })
  destination!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  sender!: ShipmentAddress | null;

  @Column({ type: 'jsonb', nullable: true })
  recipient!: ShipmentAddress | null;

  @Column({
    name: 'weight_kg',
    type: 'numeric',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  weightKg!: number | null;

  @OneToMany(() => ShipmentOffer, (offer) => offer.shipment)
  offers?: ShipmentOffer[];

  @OneToMany(() => ShipmentFile, (file) => file.shipment)
  files?: ShipmentFile[];

  @OneToMany(() => ShipmentEvent, (event) => event.shipment)
  events?: ShipmentEvent[];

  @OneToOne(() => ShipmentPayment, (payment) => payment.shipment)
  payment?: ShipmentPayment | null;
}
