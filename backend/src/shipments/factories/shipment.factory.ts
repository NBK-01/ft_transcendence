import { Organization } from '../../organizations/organization.entity';
import { User } from '../../users/user.entity';
import {
  type AttachmentKind,
  LIVE_STATES,
  ShipmentFileKind,
} from '../constants/shipment-state';
import { Shipment } from '../entities/shipment.entity';
import { ShipmentOffer } from '../entities/shipment-offer.entity';
import { ShipmentFile } from '../entities/shipment-file.entity';
import { ShipmentEvent } from '../entities/shipment-event.entity';
import {
  AdminShipmentDetailDto,
  AdminShipmentDto,
  ImageRefDto,
  ShipmentBranchDto,
  ShipmentClientDto,
  ShipmentDetailDto,
  ShipmentDto,
  ShipmentEventDto,
  ShipmentFileDto,
} from '../dto/shipment.dto';

/** storageKey → signed URL, resolved by the caller (signing is async). */
export type FileUrls = ReadonlyMap<string, string>;

export class ShipmentFactory {
  /** The offer the client sees: the newest one that hasn't been rejected. */
  static currentOffer(shipment: Shipment): ShipmentOffer | null {
    const open = (shipment.offers ?? []).filter((offer) => !offer.rejectedAt);
    open.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return open[0] ?? null;
  }

  static toDto(shipment: Shipment): ShipmentDto {
    return {
      trackingId: shipment.trackingId,
      origin: shipment.origin,
      destination: shipment.destination,
      status: shipment.status,
      updatedAt: shipment.updatedAt,
    };
  }

  /** Needs offers, files and payment loaded. */
  static toDetail(shipment: Shipment, urls: FileUrls): ShipmentDetailDto {
    const files = shipment.files ?? [];
    const offer = this.currentOffer(shipment);
    const payment = shipment.payment ?? null;
    const total = payment
      ? { amount: payment.totalAmount, currency: payment.currency }
      : null;

    return {
      ...this.toDto(shipment),
      request: {
        productUrl: shipment.productUrl,
        images: files
          .filter((file) => file.kind === ShipmentFileKind.REQUEST_PHOTO)
          .map((file) => this.toImageRef(file, urls)),
      },
      offer: offer && {
        supplierName: offer.supplierName,
        unitPrice: { amount: offer.unitPriceAmount, currency: offer.currency },
        images: files
          .filter((file) => file.offerId === offer.id)
          .map((file) => this.toImageRef(file, urls)),
        note: offer.note,
        offeredAt: offer.createdAt,
      },
      payment: payment && {
        quantity: payment.quantity,
        total: total!,
        cardLast4: payment.cardLast4,
        submittedAt: payment.createdAt,
      },
      sender: shipment.sender,
      recipient: shipment.recipient,
      weightKg: shipment.weightKg,
      declaredValue: LIVE_STATES.includes(shipment.status) ? total : null,
    };
  }

  /** Needs client and organization loaded. */
  static toAdminDto(shipment: Shipment): AdminShipmentDto {
    return {
      ...this.toDto(shipment),
      client: this.toClient(shipment.client!),
      organization: this.toBranch(shipment.organization),
      createdAt: shipment.createdAt,
    };
  }

  /** Needs client, organization, offers, files and payment loaded. */
  static toAdminDetail(
    shipment: Shipment,
    urls: FileUrls,
  ): AdminShipmentDetailDto {
    return {
      ...this.toDetail(shipment, urls),
      client: this.toClient(shipment.client!),
      organization: this.toBranch(shipment.organization),
      createdAt: shipment.createdAt,
    };
  }

  static toEvent(event: ShipmentEvent): ShipmentEventDto {
    return {
      status: event.status,
      location: event.location,
      occurredAt: event.createdAt,
    };
  }

  static toFile(file: ShipmentFile, urls: FileUrls): ShipmentFileDto {
    return {
      id: file.id,
      name: file.name,
      kind: file.kind as AttachmentKind,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedAt: file.createdAt,
      url: urls.get(file.storageKey) ?? '',
    };
  }

  private static toImageRef(file: ShipmentFile, urls: FileUrls): ImageRefDto {
    return {
      id: file.id,
      url: urls.get(file.storageKey) ?? '',
      name: file.name,
    };
  }

  private static toClient(user: User): ShipmentClientDto {
    return { id: user.id, name: user.name, email: user.email };
  }

  private static toBranch(
    organization?: Organization | null,
  ): ShipmentBranchDto | null {
    return organization
      ? { id: organization.id, name: organization.name }
      : null;
  }
}
