import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import {
  FileStorageService,
  ShipmentFileCategory,
} from '../file-storage/file-storage.service';
import {
  ATTACHMENT_KINDS,
  MAX_REQUEST_IMAGES,
  ShipmentFileKind,
  ShipmentState,
} from './constants/shipment-state';
import { Shipment } from './entities/shipment.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { ShipmentFile } from './entities/shipment-file.entity';
import { ShipmentOffer } from './entities/shipment-offer.entity';
import { ShipmentPayment } from './entities/shipment-payment.entity';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import {
  customerActor,
  ShipmentActor,
  ShipmentActorType,
} from './constants/shipment-actor';
import { ListShipmentsQueryDto } from './dto/list-shipments-query.dto';
import { ListAdminShipmentsQueryDto } from './dto/list-admin-shipments-query.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import {
  ShipmentDetailDto,
  ShipmentDto,
  ShipmentEventDto,
  ShipmentFileDto,
} from './dto/shipment.dto';
import { FileUrls, ShipmentFactory } from './factories/shipment.factory';
import {
  CardExpiredException,
  InvalidShipmentStateException,
  LinkOrPhotosRequiredException,
  ShipmentNotFoundException,
  TooManyImagesException,
} from './exceptions';

/** A file that's in the bucket but not yet in the database. */
export interface UploadedFile {
  key: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/** A status change: allowed only from one of `from`; `location` labels the timeline step. */
export interface TransitionStep {
  from: ShipmentState[];
  to: ShipmentState;
  location: string;
  /** Who's moving it: recorded on the timeline step. */
  actor: ShipmentActor;
  /** Other columns to set in the same UPDATE. */
  changes?: QueryDeepPartialEntity<Shipment>;
}

/**
 * Client-side shipment flow, plus the helpers AdminShipmentsService reuses
 * (lookups, status transitions, uploads, URL signing).
 *
 * Every client method takes the caller's User id and only ever sees that
 * client's shipments — someone else's tracking ID is a 404, not a 403.
 */
@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @InjectRepository(ShipmentEvent)
    private readonly eventRepository: Repository<ShipmentEvent>,
    @InjectRepository(ShipmentFile)
    private readonly fileRepository: Repository<ShipmentFile>,
    private readonly dataSource: DataSource,
    private readonly fileStorageService: FileStorageService,
  ) {}

  /* ---------------------------------------------------------------------
   * Client actions
   * ------------------------------------------------------------------- */

  async list(
    clientId: string,
    query: ListShipmentsQueryDto,
  ): Promise<PaginatedResponseDto<ShipmentDto>> {
    const [rows, total] = await this.listQuery(query, clientId);
    return PaginatedResponseDto.create(
      rows.map((shipment) => ShipmentFactory.toDto(shipment)),
      total,
      query.page,
      query.limit,
    );
  }

  async getDetail(
    clientId: string,
    trackingId: string,
  ): Promise<ShipmentDetailDto> {
    const shipment = await this.findWithDetail(trackingId, clientId);
    return ShipmentFactory.toDetail(
      shipment,
      await this.signUrls(shipment.files),
    );
  }

  /** A product link or 1–5 photos (not both). Starts in pending_sourcing, waiting on the admin. */
  async create(
    clientId: string,
    dto: CreateShipmentDto,
    images: Express.Multer.File[],
  ): Promise<ShipmentDetailDto> {
    const productUrl = dto.productUrl?.trim() || null;
    if (!productUrl === !images.length) {
      throw new LinkOrPhotosRequiredException();
    }
    if (images.length > MAX_REQUEST_IMAGES) {
      throw new TooManyImagesException(MAX_REQUEST_IMAGES);
    }

    const trackingId = await this.generateTrackingId();
    const uploaded = await this.uploadFiles(trackingId, images, 'image');

    await this.withUploadCleanup(uploaded, () =>
      this.dataSource.transaction(async (manager) => {
        const shipment = await manager.save(
          manager.create(Shipment, {
            trackingId,
            clientId,
            productUrl,
            status: ShipmentState.PENDING_SOURCING,
          }),
        );
        await this.insertFiles(
          manager,
          shipment.id,
          uploaded,
          ShipmentFileKind.REQUEST_PHOTO,
        );
        await manager.insert(ShipmentEvent, {
          shipmentId: shipment.id,
          status: ShipmentState.PENDING_SOURCING,
          location: 'Request received',
          actorType: ShipmentActorType.CUSTOMER,
          actorId: clientId,
        });
      }),
    );

    return this.getDetail(clientId, trackingId);
  }

  async acceptOffer(
    clientId: string,
    trackingId: string,
  ): Promise<ShipmentDetailDto> {
    const shipment = await this.findOne(trackingId, clientId);
    await this.dataSource.transaction((manager) =>
      this.transition(manager, shipment, {
        from: [ShipmentState.PENDING_CLIENT_DECISION],
        to: ShipmentState.PENDING_PAYMENT,
        location: 'Offer approved',
        actor: customerActor(clientId),
      }),
    );
    return this.getDetail(clientId, trackingId);
  }

  /** Back to pending_sourcing: the admin looks for another supplier. The rejected offer is kept as history. */
  async rejectOffer(
    clientId: string,
    trackingId: string,
  ): Promise<ShipmentDetailDto> {
    const shipment = await this.findWithDetail(trackingId, clientId);
    const offer = ShipmentFactory.currentOffer(shipment);
    await this.dataSource.transaction(async (manager) => {
      await this.transition(manager, shipment, {
        from: [ShipmentState.PENDING_CLIENT_DECISION],
        to: ShipmentState.PENDING_SOURCING,
        location: 'Offer rejected, finding another supplier',
        actor: customerActor(clientId),
      });
      if (offer) {
        await manager.update(ShipmentOffer, offer.id, {
          rejectedAt: new Date(),
        });
      }
    });
    return this.getDetail(clientId, trackingId);
  }

  /** Demo checkout: records the payment and waits for the admin to confirm it. */
  async submitPayment(
    clientId: string,
    trackingId: string,
    dto: SubmitPaymentDto,
  ): Promise<ShipmentDetailDto> {
    const shipment = await this.findWithDetail(trackingId, clientId);
    const offer = ShipmentFactory.currentOffer(shipment);
    if (shipment.status !== ShipmentState.PENDING_PAYMENT || !offer) {
      throw new InvalidShipmentStateException(shipment.status);
    }

    const now = new Date();
    const { expMonth, expYear } = dto.card;
    if (
      expYear < now.getFullYear() ||
      (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)
    ) {
      throw new CardExpiredException();
    }

    await this.dataSource.transaction(async (manager) => {
      await this.transition(manager, shipment, {
        from: [ShipmentState.PENDING_PAYMENT],
        to: ShipmentState.PENDING_PAYMENT_CONFIRMATION,
        location: 'Payment submitted',
        actor: customerActor(clientId),
      });
      await manager.insert(ShipmentPayment, {
        shipmentId: shipment.id,
        quantity: dto.quantity,
        totalAmount:
          Math.round(offer.unitPriceAmount * dto.quantity * 100) / 100,
        currency: offer.currency,
        cardHolderName: dto.card.holderName.trim(),
        cardLast4: dto.card.last4,
      });
    });
    return this.getDetail(clientId, trackingId);
  }

  /** Newest first. Pass no clientId for admin access. */
  async listEvents(
    trackingId: string,
    clientId?: string,
  ): Promise<ShipmentEventDto[]> {
    const shipment = await this.findOne(trackingId, clientId);
    const events = await this.eventRepository.find({
      where: { shipmentId: shipment.id },
      order: { createdAt: 'DESC' },
    });
    return events.map((event) => ShipmentFactory.toEvent(event));
  }

  /** The Files tab: package photos, proof of delivery, other attachments. Newest first. Pass no clientId for admin access. */
  async listFiles(
    trackingId: string,
    clientId?: string,
  ): Promise<ShipmentFileDto[]> {
    const shipment = await this.findOne(trackingId, clientId);
    const files = await this.fileRepository.find({
      where: { shipmentId: shipment.id, kind: In([...ATTACHMENT_KINDS]) },
      order: { createdAt: 'DESC' },
    });
    const urls = await this.signUrls(files);
    return files.map((file) => ShipmentFactory.toFile(file, urls));
  }

  /* ---------------------------------------------------------------------
   * Shared with AdminShipmentsService
   * ------------------------------------------------------------------- */

  /**
   * clientId given: only that client's shipments. Omitted (admin): everyone's,
   * with the client and the branch joined, optionally one branch's only.
   */
  listQuery(
    query: ListAdminShipmentsQueryDto,
    clientId?: string,
  ): Promise<[Shipment[], number]> {
    const qb = this.shipmentRepository.createQueryBuilder('shipment');
    if (clientId) {
      qb.andWhere('shipment.clientId = :clientId', { clientId });
    } else {
      qb.innerJoinAndSelect('shipment.client', 'client').leftJoinAndSelect(
        'shipment.organization',
        'organization',
      );
    }
    if (query.organizationId) {
      qb.andWhere('shipment.organizationId = :organizationId', {
        organizationId: query.organizationId,
      });
    }
    const q = query.q?.trim();
    if (q) {
      qb.andWhere('shipment.trackingId ILIKE :q', {
        q: `%${q.replace(/[\\%_]/g, '\\$&')}%`,
      });
    }
    if (query.status) {
      qb.andWhere('shipment.status = :status', { status: query.status });
    }
    return qb
      .orderBy('shipment.updatedAt', 'DESC')
      .addOrderBy('shipment.id', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
  }

  /** Tracking IDs are matched case-insensitively, ignoring stray spaces from copy-paste. Pass no clientId for admin access. */
  async findOne(trackingId: string, clientId?: string): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findOne({
      where: { trackingId: trackingId.trim().toUpperCase(), clientId },
    });
    if (!shipment) {
      throw new ShipmentNotFoundException(trackingId);
    }
    return shipment;
  }

  /** With everything the detail view needs: offers, files, payment (and the client and branch, for admin access). */
  async findWithDetail(
    trackingId: string,
    clientId?: string,
  ): Promise<Shipment> {
    const shipment = await this.shipmentRepository.findOne({
      where: { trackingId: trackingId.trim().toUpperCase(), clientId },
      relations: {
        offers: true,
        files: true,
        payment: true,
        client: !clientId,
        organization: !clientId,
      },
    });
    if (!shipment) {
      throw new ShipmentNotFoundException(trackingId);
    }
    return shipment;
  }

  /**
   * Moves the shipment from one of `from` to `to` and adds a timeline step.
   * The status check is part of the UPDATE itself, so two racing requests
   * (a double-clicked "Accept") can't both win: the loser gets a 409.
   */
  async transition(
    manager: EntityManager,
    shipment: Shipment,
    { from, to, location, actor, changes = {} }: TransitionStep,
  ): Promise<void> {
    if (!from.includes(shipment.status)) {
      throw new InvalidShipmentStateException(shipment.status);
    }
    const result = await manager
      .createQueryBuilder()
      .update(Shipment)
      .set({ ...changes, status: to })
      .where('id = :id', { id: shipment.id })
      .andWhere('status IN (:...from)', { from })
      .execute();
    if (!result.affected) {
      throw new InvalidShipmentStateException(shipment.status);
    }
    await manager.insert(ShipmentEvent, {
      shipmentId: shipment.id,
      status: to,
      location,
      actorType: actor.type,
      actorId: actor.id,
    });
    shipment.status = to;
  }

  /** Validates every file first, then uploads. If one upload fails, the ones already uploaded are deleted. */
  async uploadFiles(
    trackingId: string,
    files: Express.Multer.File[],
    category: ShipmentFileCategory,
  ): Promise<UploadedFile[]> {
    for (const file of files) {
      this.fileStorageService.validateShipmentFile(
        file.buffer,
        file.mimetype,
        category,
      );
    }
    const uploaded: UploadedFile[] = [];
    try {
      for (const file of files) {
        const { key } = await this.fileStorageService.uploadShipmentFile(
          file.buffer,
          trackingId,
          file.originalname,
          file.mimetype,
          category,
        );
        uploaded.push({
          key,
          name: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
      }
    } catch (error) {
      await this.deleteUploads(uploaded);
      throw error;
    }
    return uploaded;
  }

  /** Runs `work`; if it throws, the files it was about to reference are removed from the bucket. */
  async withUploadCleanup<T>(
    uploaded: UploadedFile[],
    work: () => Promise<T>,
  ): Promise<T> {
    try {
      return await work();
    } catch (error) {
      await this.deleteUploads(uploaded);
      throw error;
    }
  }

  async insertFiles(
    manager: EntityManager,
    shipmentId: string,
    uploaded: UploadedFile[],
    kind: ShipmentFileKind,
    offerId: string | null = null,
  ): Promise<ShipmentFile[]> {
    if (!uploaded.length) {
      return [];
    }
    return manager.save(
      uploaded.map((file) =>
        manager.create(ShipmentFile, {
          shipmentId,
          offerId,
          kind,
          storageKey: file.key,
          name: file.name,
          mimeType: file.mimeType,
          sizeBytes: file.sizeBytes,
        }),
      ),
    );
  }

  /** Every stored file goes back to the client as a fresh signed URL — keys never leave the server. */
  async signUrls(files: ShipmentFile[] = []): Promise<FileUrls> {
    const entries = await Promise.all(
      files.map(
        async (file) =>
          [
            file.storageKey,
            await this.fileStorageService.getFileUrl(file.storageKey),
          ] as const,
      ),
    );
    return new Map(entries);
  }

  /* ---------------------------------------------------------------------
   * Internals
   * ------------------------------------------------------------------- */

  /**
   * "TRK-" + 6 hex digits (16.7M combinations); retried on the rare collision.
   * Not private: the public API's partner shipments get their ids here too.
   */
  async generateTrackingId(): Promise<string> {
    for (;;) {
      const trackingId = `TRK-${randomBytes(3).toString('hex').toUpperCase()}`;
      if (!(await this.shipmentRepository.exists({ where: { trackingId } }))) {
        return trackingId;
      }
    }
  }

  /** Best effort: a failed delete only leaves an orphan object behind, so log it rather than mask the original error. */
  private async deleteUploads(uploaded: UploadedFile[]): Promise<void> {
    await Promise.all(
      uploaded.map((file) =>
        this.fileStorageService.deleteFile(file.key).catch((error) => {
          this.logger.warn(
            `Could not delete orphaned upload ${file.key}: ${String(error)}`,
          );
        }),
      ),
    );
  }
}
