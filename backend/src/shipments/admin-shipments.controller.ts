import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/access-control.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';
import { MissingRequiredDataException } from '../common/exceptions/validation-exceptions';
import { AdminShipmentsService } from './admin-shipments.service';
import { ShipmentsService } from './shipments.service';
import { MAX_UPLOAD_FILES, UPLOAD_HARD_LIMITS } from './shipments.controller';
import { ATTACHMENT_KINDS } from './constants/shipment-state';
import { ListAdminShipmentsQueryDto } from './dto/list-admin-shipments-query.dto';
import { CreateOfferDto } from './dto/create-offer.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UploadFileDto } from './dto/upload-file.dto';
import {
  AdminShipmentDetailDto,
  ShipmentEventDto,
  ShipmentFileDto,
} from './dto/shipment.dto';

/**
 * Staff side of shipments. Only partner-created shipments belong to a branch
 * (organizationId; the list can filter by it), so reads still use
 * shipments:read:all and every change uses shipments:update:org
 * (admin holds both; admins also pass every permission check anyway).
 */
@ApiTags('Admin shipments')
@ApiBearerAuth()
@Controller('admin/shipments')
export class AdminShipmentsController {
  constructor(
    private readonly adminShipmentsService: AdminShipmentsService,
    private readonly shipmentsService: ShipmentsService,
  ) {}

  @RequirePermission('shipments:read:all')
  @Get()
  @ApiOperation({
    summary:
      'List all shipments, most recently updated first (filter status=pending_sourcing for the sourcing queue)',
  })
  async list(@Query() query: ListAdminShipmentsQueryDto) {
    return this.adminShipmentsService.list(query);
  }

  @RequirePermission('shipments:read:all')
  @Get(':trackingId')
  @ApiOperation({ summary: 'Get one shipment, with its client' })
  @ApiResponse({ status: 200, type: AdminShipmentDetailDto })
  async getOne(@Param('trackingId') trackingId: string) {
    return this.adminShipmentsService.getDetail(trackingId);
  }

  @RequirePermission('shipments:read:all')
  @Get(':trackingId/events')
  @ApiOperation({ summary: "The shipment's timeline, newest first" })
  @ApiResponse({ status: 200, type: [ShipmentEventDto] })
  async listEvents(@Param('trackingId') trackingId: string) {
    return this.shipmentsService.listEvents(trackingId);
  }

  @RequirePermission('shipments:read:all')
  @Get(':trackingId/files')
  @ApiOperation({ summary: "The shipment's attachments, newest first" })
  @ApiResponse({ status: 200, type: [ShipmentFileDto] })
  async listFiles(@Param('trackingId') trackingId: string) {
    return this.shipmentsService.listFiles(trackingId);
  }

  @RequirePermission('shipments:update:org')
  @Post(':trackingId/offer')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['supplierName', 'unitPrice', 'currency'],
      properties: {
        supplierName: { type: 'string', example: 'Shenzhen Gadget Co.' },
        unitPrice: { type: 'number', example: 24.9 },
        currency: { type: 'string', example: 'USD' },
        note: { type: 'string' },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', MAX_UPLOAD_FILES, {
      limits: UPLOAD_HARD_LIMITS,
    }),
  )
  @ApiOperation({
    summary:
      'Send a supplier offer to the client (pending_sourcing → pending_client_decision)',
  })
  @ApiResponse({ status: 201, type: AdminShipmentDetailDto })
  @ApiResponse({ status: 409, description: 'Not in pending_sourcing' })
  async createOffer(
    @CurrentUser() staff: RequestUser,
    @Param('trackingId') trackingId: string,
    @Body() dto: CreateOfferDto,
    @UploadedFiles() images: Express.Multer.File[] = [],
  ) {
    return this.adminShipmentsService.createOffer(
      staff.id,
      trackingId,
      dto,
      images,
    );
  }

  @RequirePermission('shipments:update:org')
  @Post(':trackingId/payment/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Confirm the payment and set the route (pending_payment_confirmation → confirmed)',
  })
  @ApiResponse({ status: 200, type: AdminShipmentDetailDto })
  @ApiResponse({ status: 409, description: 'No payment waiting' })
  async confirmPayment(
    @CurrentUser() staff: RequestUser,
    @Param('trackingId') trackingId: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    return this.adminShipmentsService.confirmPayment(staff.id, trackingId, dto);
  }

  @RequirePermission('shipments:update:org')
  @Post(':trackingId/events')
  @ApiOperation({
    summary:
      'Post a tracking update: in_transit, out_for_delivery, delivered, or cancelled',
  })
  @ApiResponse({ status: 201, type: AdminShipmentDetailDto })
  @ApiResponse({
    status: 409,
    description: 'Not allowed from the current status',
  })
  async addEvent(
    @CurrentUser() staff: RequestUser,
    @Param('trackingId') trackingId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.adminShipmentsService.addEvent(staff.id, trackingId, dto);
  }

  @RequirePermission('shipments:update:org')
  @Post(':trackingId/files')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['kind', 'file'],
      properties: {
        kind: { type: 'string', enum: [...ATTACHMENT_KINDS] },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_HARD_LIMITS }))
  @ApiOperation({
    summary: "Attach a file to the client's Files tab (image or PDF, 10 MB)",
  })
  @ApiResponse({ status: 201, type: ShipmentFileDto })
  async uploadFile(
    @Param('trackingId') trackingId: string,
    @Body() dto: UploadFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new MissingRequiredDataException('file');
    }
    return this.adminShipmentsService.uploadFile(trackingId, dto, file);
  }

  @RequirePermission('shipments:update:org')
  @Delete(':trackingId/files/:fileId')
  @ApiOperation({
    summary:
      'Remove a file (offer photos only while pending_client_decision)',
  })
  @ApiResponse({ status: 404, description: 'Not found' })
  @ApiResponse({ status: 409, description: "Can't be deleted right now" })
  async deleteFile(
    @Param('trackingId') trackingId: string,
    @Param('fileId') fileId: string,
  ) {
    await this.adminShipmentsService.deleteFile(trackingId, fileId);
    return { message: 'File removed' };
  }
}
