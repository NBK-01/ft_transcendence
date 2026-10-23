import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { numericTransformer } from './numeric.transformer';
import { Shipment } from './shipment.entity';
import { ShipmentFile } from './shipment-file.entity';

/**
 * A supplier the admin found for a shipment. Rejected offers are kept (with
 * rejectedAt set) as history; the shipment's current offer is its newest
 * one that isn't rejected.
 */
@Entity('shipment_offer')
export class ShipmentOffer extends BaseEntity {
  @Index()
  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId!: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.offers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shipment_id' })
  shipment?: Shipment;

  @Column({ name: 'supplier_name' })
  supplierName!: string;

  @Column({
    name: 'unit_price_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  unitPriceAmount!: number;

  /** ISO 4217, e.g. "EUR". */
  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ name: 'rejected_at', type: 'timestamptz', nullable: true })
  rejectedAt!: Date | null;

  @OneToMany(() => ShipmentFile, (file) => file.offer)
  images?: ShipmentFile[];
}
