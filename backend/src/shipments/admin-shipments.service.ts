import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AccessControlService,
  BranchScope,
} from '../access-control/access-control.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import {
  MAX_REQUEST_IMAGES,
  ShipmentFileKind,
  ShipmentState,
  TRACKING_TRANSITIONS,
} from './constants/shipment-state';
import { staffActor } from './constants/shipment-actor';
import { ShipmentOffer } from './entities/shipment-offer.entity';
import { ListAdminShipmentsQueryDto } from './dto/list-admin-shipments-query.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import {
  AdminShipmentDetailDto,
  AdminShipmentDto,
  ShipmentFileDto,
} from './dto/shipment.dto';
import { ShipmentFactory } from './factories/shipment.factory';
import { ShipmentsService } from './shipments.service';
import {
  InvalidShipmentStateException,
  ShipmentBranchLockedException,
  ShipmentFileNotDeletableException,
  ShipmentNotFoundException,
  TooManyImagesException,
} from './exceptions';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { Organization } from '../organizations/organization.entity';
import {
  OrganizationInactiveException,
  OrganizationNotFoundException,
} from '../organizations/exceptions';

/**
 * The staff's side of the flow: source a supplier, confirm payment, then
 * post tracking updates and files. Every route works within the caller's
 * branch scope (AccessControlService.branchScope): all shipments for admins
 * and support, only their own branch's for a dispatcher. Outside it, a
 * shipment is a 404, as if it didn't exist.
 */
@Injectable()
export class AdminShipmentsService {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly dataSource: DataSource,
    private readonly accessControlService: AccessControlService,
  ) {}

  async list(
    staffId: string,
    query: ListAdminShipmentsQueryDto,
  ): Promise<PaginatedResponseDto<AdminShipmentDto>> {
    const scope = await this.accessControlService.branchScope(staffId);
    if (!scope.all && !scope.organizationId) {
      // In no branch: nothing to see. Never query with an empty filter, which would list everything.
      return PaginatedResponseDto.create([], 0, query.page, query.limit);
    }
    const scoped = scope.all
      ? query
      : { ...query, organizationId: scope.organizationId };
    const [rows, total] = await this.shipmentsService.listQuery(
      scoped as ListAdminShipmentsQueryDto,
    );
    return PaginatedResponseDto.create(
      rows.map((shipment) => ShipmentFactory.toAdminDto(shipment)),
      total,
      query.page,
      query.limit,
    );
  }

  /** The shipment, if the caller's scope reaches it; otherwise 404 (3001). */
  async findInScope(staffId: string, trackingId: string) {
    const [shipment, scope] = await Promise.all([
      this.shipmentsService.findOne(trackingId),
      this.accessControlService.branchScope(staffId),
    ]);
    if (!inScope(scope, shipment.organizationId)) {
      throw new ShipmentNotFoundException(trackingId);
    }
    return shipment;
  }

  async getDetailFor(
    staffId: string,
    trackingId: string,
  ): Promise<AdminShipmentDetailDto> {
    await this.findInScope(staffId, trackingId);
    return this.getDetail(trackingId);
  }

  async listEvents(staffId: string, trackingId: string) {
    await this.findInScope(staffId, trackingId);
    return this.shipmentsService.listEvents(trackingId);
  }

  async listFiles(staffId: string, trackingId: string) {
    await this.findInScope(staffId, trackingId);
    return this.shipmentsService.listFiles(trackingId);
  }

  private async getDetail(trackingId: string): Promise<AdminShipmentDetailDto> {
    const shipment = await this.shipmentsService.findWithDetail(trackingId);
    return ShipmentFactory.toAdminDetail(
      shipment,
      await this.shipmentsService.signUrls(shipment.files),
    );
  }

  /** pending_sourcing → pending_client_decision: the client now sees this supplier and can accept or reject. */
  async createOffer(
    staffId: string,
    trackingId: string,
    dto: CreateOfferDto,
    images: Express.Multer.File[],
  ): Promise<AdminShipmentDetailDto> {
    const shipment = await this.findInScope(staffId, trackingId);
    // Checked before uploading so a wrong-stage request doesn't touch the bucket.
    // transition() re-checks inside the transaction, in case it changes meanwhile.
    if (shipment.status !== ShipmentState.PENDING_SOURCING) {
      throw new InvalidShipmentStateException(shipment.status);
    }
    if (images.length > MAX_REQUEST_IMAGES) {
      throw new TooManyImagesException(MAX_REQUEST_IMAGES);
    }

    const uploaded = await this.shipmentsService.uploadFiles(
      shipment.trackingId,
      images,
      'image',
    );
    await this.shipmentsService.withUploadCleanup(uploaded, () =>
      this.dataSource.transaction(async (manager) => {
        const supplierName = dto.supplierName.trim();
        await this.shipmentsService.transition(manager, shipment, {
          from: [ShipmentState.PENDING_SOURCING],
          to: ShipmentState.PENDING_CLIENT_DECISION,
          location: `Offer from ${supplierName}`,
          actor: staffActor(staffId),
        });
        const offer = await manager.save(
          manager.create(ShipmentOffer, {
            shipmentId: shipment.id,
            supplierName,
            unitPriceAmount: dto.unitPrice,
            currency: dto.currency.toUpperCase(),
            note: dto.note?.trim() || null,
          }),
        );
        await this.shipmentsService.insertFiles(
          manager,
          shipment.id,
          uploaded,
          ShipmentFileKind.OFFER_PHOTO,
          offer.id,
        );
      }),
    );
    return this.getDetail(trackingId);
  }

  /** pending_payment_confirmation → confirmed: the order is live, with its route and weight set. */
  async confirmPayment(
    staffId: string,
    trackingId: string,
    dto: ConfirmPaymentDto,
  ): Promise<AdminShipmentDetailDto> {
    const shipment = await this.findInScope(staffId, trackingId);
    const sender = { ...dto.sender, city: dto.sender.city.trim() };
    const recipient = { ...dto.recipient, city: dto.recipient.city.trim() };
    await this.dataSource.transaction((manager) =>
      this.shipmentsService.transition(manager, shipment, {
        from: [ShipmentState.PENDING_PAYMENT_CONFIRMATION],
        to: ShipmentState.CONFIRMED,
        location: 'Payment confirmed',
        actor: staffActor(staffId),
        changes: {
          sender,
          recipient,
          origin: sender.city,
          destination: recipient.city,
          weightKg: dto.weightKg,
        },
      }),
    );
    return this.getDetail(trackingId);
  }

  /** A tracking update (in transit, out for delivery, delivered) or a cancellation. See TRACKING_TRANSITIONS. */
  async addEvent(
    staffId: string,
    trackingId: string,
    dto: CreateEventDto,
  ): Promise<AdminShipmentDetailDto> {
    const shipment = await this.findInScope(staffId, trackingId);
    await this.dataSource.transaction((manager) =>
      this.shipmentsService.transition(manager, shipment, {
        from: TRACKING_TRANSITIONS[dto.status] ?? [],
        to: dto.status,
        location: dto.location.trim(),
        actor: staffActor(staffId),
      }),
    );
    return this.getDetail(trackingId);
  }

  /**
   * Hands a customer's order to a branch (or takes it off one, with null),
   * so that branch's dispatchers work on it. A partner's shipment stays with
   * the branch that created it (409, 3008); a deactivated branch takes no
   * new orders (409, 4005).
   */
  async assignBranch(
    trackingId: string,
    organizationId: string | null,
  ): Promise<AdminShipmentDetailDto> {
    const shipment = await this.shipmentsService.findOne(trackingId);
    await this.dataSource.transaction(async (manager) => {
      // A customer's order starts at pending_sourcing; a partner's straight at confirmed.
      const first = await manager.findOne(ShipmentEvent, {
        where: { shipmentId: shipment.id },
        order: { createdAt: 'ASC' },
      });
      if (first?.status === ShipmentState.CONFIRMED) {
        throw new ShipmentBranchLockedException(shipment.trackingId);
      }
      if (organizationId) {
        const branch = await manager.findOne(Organization, {
          where: { id: organizationId },
        });
        if (!branch) {
          throw new OrganizationNotFoundException(organizationId);
        }
        if (!branch.isActive) {
          throw new OrganizationInactiveException(branch.name);
        }
      }
      if (shipment.organizationId !== organizationId) {
        shipment.organizationId = organizationId;
        // save(), not update(): the notification subscriber reads the old branch from it.
        await manager.save(shipment);
      }
    });
    return this.getDetail(trackingId);
  }

  /** Adds a file to the client's Files tab: an image or a PDF, up to 10 MB. */
  async uploadFile(
    staffId: string,
    trackingId: string,
    dto: UploadFileDto,
    file: Express.Multer.File,
  ): Promise<ShipmentFileDto> {
    // Checked before uploading, so an out-of-scope request doesn't touch the bucket.
    const shipment = await this.findInScope(staffId, trackingId);
    const uploaded = await this.shipmentsService.uploadFiles(
      shipment.trackingId,
      [file],
      'document',
    );
    const [saved] = await this.shipmentsService.withUploadCleanup(
      uploaded,
      () =>
        this.dataSource.transaction((manager) =>
          this.shipmentsService.insertFiles(
            manager,
            shipment.id,
            uploaded,
            dto.kind as ShipmentFileKind,
          ),
        ),
    );
    return ShipmentFactory.toFile(
      saved!,
      await this.shipmentsService.signUrls([saved!]),
    );
  }

  /**
   * Removes a file. Offer photos only while the client is still deciding
   * (pending_client_decision) — once accepted/rejected they're history.
   * Request photos aren't touched here: those are the client's own, removed
   * via ShipmentsService.deleteOwnFile instead.
   */
  async deleteFile(
    staffId: string,
    trackingId: string,
    fileId: string,
  ): Promise<void> {
    // Same scope as every other change: a dispatcher, their branch's shipments only.
    const shipment = await this.findInScope(staffId, trackingId);
    const file = await this.shipmentsService.findFile(shipment.id, fileId);
    if (file.kind === ShipmentFileKind.REQUEST_PHOTO) {
      throw new ShipmentFileNotDeletableException();
    }
    if (
      file.kind === ShipmentFileKind.OFFER_PHOTO &&
      shipment.status !== ShipmentState.PENDING_CLIENT_DECISION
    ) {
      throw new ShipmentFileNotDeletableException();
    }
    await this.shipmentsService.removeFile(file);
  }
}

const inScope = (scope: BranchScope, organizationId: string | null) =>
  scope.all ||
  (!!scope.organizationId && organizationId === scope.organizationId);
