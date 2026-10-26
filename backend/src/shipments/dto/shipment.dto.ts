import { ApiProperty } from '@nestjs/swagger';
import {
  ATTACHMENT_KINDS,
  type AttachmentKind,
  ShipmentState,
} from '../constants/shipment-state';
import { AddressDto } from './address.dto';

/**
 * Response shapes. They match the client frontend's types
 * (apps/client/src/features/shipments/types.ts) field for field — change
 * both together. Every `url` is a freshly signed link that expires after an
 * hour; clients refetch rather than store it.
 */

export class MoneyDto {
  @ApiProperty({ example: 24.9 })
  amount!: number;

  @ApiProperty({ example: 'EUR', description: 'ISO 4217' })
  currency!: string;
}

export class ImageRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Signed URL, valid for 1 hour' })
  url!: string;

  @ApiProperty({ example: 'front.jpg' })
  name!: string;
}

/** A row of the shipments list. */
export class ShipmentDto {
  @ApiProperty({ example: 'TRK-4A6F90' })
  trackingId!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Istanbul' })
  origin!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Paris' })
  destination!: string | null;

  @ApiProperty({ enum: ShipmentState })
  status!: ShipmentState;

  @ApiProperty({ type: Date })
  updatedAt!: Date;
}

export class ShipmentRequestDto {
  @ApiProperty({ type: String, nullable: true })
  productUrl!: string | null;

  @ApiProperty({ type: [ImageRefDto] })
  images!: ImageRefDto[];
}

export class SupplierOfferDto {
  @ApiProperty({ example: 'Shenzhen Gadget Co.' })
  supplierName!: string;

  @ApiProperty({ type: MoneyDto })
  unitPrice!: MoneyDto;

  @ApiProperty({ type: [ImageRefDto] })
  images!: ImageRefDto[];

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ type: Date })
  offeredAt!: Date;
}

export class PaymentSummaryDto {
  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ type: MoneyDto })
  total!: MoneyDto;

  @ApiProperty({ example: '4242' })
  cardLast4!: string;

  @ApiProperty({ type: Date })
  submittedAt!: Date;
}

export class ShipmentDetailDto extends ShipmentDto {
  @ApiProperty({ type: ShipmentRequestDto })
  request!: ShipmentRequestDto;

  @ApiProperty({
    type: SupplierOfferDto,
    nullable: true,
    description: 'Present from pending_client_decision on',
  })
  offer!: SupplierOfferDto | null;

  @ApiProperty({
    type: PaymentSummaryDto,
    nullable: true,
    description: 'Present from pending_payment_confirmation on',
  })
  payment!: PaymentSummaryDto | null;

  @ApiProperty({ type: AddressDto, nullable: true })
  sender!: AddressDto | null;

  @ApiProperty({ type: AddressDto, nullable: true })
  recipient!: AddressDto | null;

  @ApiProperty({ type: Number, nullable: true, example: 1.5 })
  weightKg!: number | null;

  @ApiProperty({ type: MoneyDto, nullable: true })
  declaredValue!: MoneyDto | null;
}

export class ShipmentEventDto {
  @ApiProperty({ enum: ShipmentState })
  status!: ShipmentState;

  @ApiProperty({ example: 'Lyon hub' })
  location!: string;

  @ApiProperty({ type: Date })
  occurredAt!: Date;
}

export class ShipmentFileDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'proof-of-delivery.pdf' })
  name!: string;

  @ApiProperty({ enum: ATTACHMENT_KINDS })
  kind!: AttachmentKind;

  @ApiProperty({ example: 'application/pdf' })
  mimeType!: string;

  @ApiProperty({ example: 248000 })
  sizeBytes!: number;

  @ApiProperty({ type: Date })
  uploadedAt!: Date;

  @ApiProperty({ description: 'Signed URL, valid for 1 hour' })
  url!: string;
}

export class ShipmentClientDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ format: 'email' })
  email!: string;
}

export class ShipmentBranchDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

const BRANCH_DESCRIPTION =
  'The branch handling it. Set on shipments a partner created through the public API; customer requests have none';

/** Admin list row: the client row plus who ordered it, when, and which branch has it. */
export class AdminShipmentDto extends ShipmentDto {
  @ApiProperty({ type: ShipmentClientDto })
  client!: ShipmentClientDto;

  @ApiProperty({
    type: ShipmentBranchDto,
    nullable: true,
    description: BRANCH_DESCRIPTION,
  })
  organization!: ShipmentBranchDto | null;

  @ApiProperty({ type: Date })
  createdAt!: Date;
}

export class AdminShipmentDetailDto extends ShipmentDetailDto {
  @ApiProperty({ type: ShipmentClientDto })
  client!: ShipmentClientDto;

  @ApiProperty({
    type: ShipmentBranchDto,
    nullable: true,
    description: BRANCH_DESCRIPTION,
  })
  organization!: ShipmentBranchDto | null;

  @ApiProperty({ type: Date })
  createdAt!: Date;
}
