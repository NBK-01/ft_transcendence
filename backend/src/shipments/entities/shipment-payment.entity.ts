import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { numericTransformer } from './numeric.transformer';
import { Shipment } from './shipment.entity';

/** What the client submitted at checkout. Demo payment: never the full card number or CVC. */
@Entity('shipment_payment')
export class ShipmentPayment extends BaseEntity {
  /** One payment per shipment — the @OneToOne join column carries the unique constraint. */
  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId!: string;

  @OneToOne(() => Shipment, (shipment) => shipment.payment, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shipment_id' })
  shipment?: Shipment;

  @Column({ type: 'integer' })
  quantity!: number;

  @Column({
    name: 'total_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: numericTransformer,
  })
  totalAmount!: number;

  /** ISO 4217, copied from the accepted offer. */
  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({ name: 'card_holder_name' })
  cardHolderName!: string;

  @Column({ name: 'card_last4', type: 'varchar', length: 4 })
  cardLast4!: string;
}
