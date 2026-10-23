import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ShipmentFileKind } from '../constants/shipment-state';
import { Shipment } from './shipment.entity';
import { ShipmentOffer } from './shipment-offer.entity';

/**
 * Any file attached to a shipment: request photos, offer photos, package
 * photos, proof of delivery. The file itself lives in the storage bucket —
 * only its key is stored here, and a fresh signed URL is generated on every
 * read (FileStorageService.getFileUrl), since signed URLs expire.
 */
@Entity('shipment_file')
export class ShipmentFile extends BaseEntity {
  @Index()
  @Column({ name: 'shipment_id', type: 'uuid' })
  shipmentId!: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.files, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'shipment_id' })
  shipment?: Shipment;

  /** Set only for offer photos. */
  @Column({ name: 'offer_id', type: 'uuid', nullable: true })
  offerId!: string | null;

  @ManyToOne(() => ShipmentOffer, (offer) => offer.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'offer_id' })
  offer?: ShipmentOffer | null;

  @Column({ type: 'enum', enum: ShipmentFileKind })
  kind!: ShipmentFileKind;

  @Column({ name: 'storage_key' })
  storageKey!: string;

  /** The original filename, shown to users. */
  @Column()
  name!: string;

  @Column({ name: 'mime_type' })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes!: number;
}
