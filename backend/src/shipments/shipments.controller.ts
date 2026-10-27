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
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequireCustomer } from '../common/decorators/access-control.decorator';
import { RequestUser } from '../common/context/auth-context.types';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { ListShipmentsQueryDto } from './dto/list-shipments-query.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import {
  ShipmentDetailDto,
  ShipmentEventDto,
  ShipmentFileDto,
} from './dto/shipment.dto';

/**
 * Generous hard caps against abuse/memory exhaustion — the real limits (5
 * photos, 10MB each, image types) are checked by the service and
 * FileStorageService, which throw typed errors instead of multer's untyped ones.
 */
export const UPLOAD_HARD_LIMITS = { fileSize: 15 * 1024 * 1024 };
export const MAX_UPLOAD_FILES = 10;

/** The client's own shipments. Customer tokens only — staff use /admin/shipments. */
@ApiTags('Shipments')
@ApiBearerAuth()
@RequireCustomer()
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Get()
  @ApiOperation({
    summary: "List the caller's shipments, most recently updated first",
  })
  async list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListShipmentsQueryDto,
  ) {
    return this.shipmentsService.list(user.id, query);
  }

  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'A product link OR 1–5 photos, not both',
    schema: {
      type: 'object',
      properties: {
        productUrl: { type: 'string', format: 'uri' },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('images', MAX_UPLOAD_FILES, {
      limits: UPLOAD_HARD_LIMITS,
    }),
  )
  @ApiOperation({ summary: 'Request a product (starts in pending_sourcing)' })
  @ApiResponse({ status: 201, type: ShipmentDetailDto })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateShipmentDto,
    @UploadedFiles() images: Express.Multer.File[] = [],
  ) {
    return this.shipmentsService.create(user.id, dto, images);
  }

  @Get(':trackingId')
  @ApiOperation({ summary: 'Get one shipment with its details' })
  @ApiResponse({ status: 200, type: ShipmentDetailDto })
  @ApiResponse({ status: 404, description: "Not found, or not the caller's" })
  async getOne(
    @CurrentUser() user: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.shipmentsService.getDetail(user.id, trackingId);
  }

  @Post(':trackingId/offer/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Accept the supplier offer (→ pending_payment)',
  })
  @ApiResponse({ status: 200, type: ShipmentDetailDto })
  @ApiResponse({ status: 409, description: 'No offer is waiting' })
  async acceptOffer(
    @CurrentUser() user: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.shipmentsService.acceptOffer(user.id, trackingId);
  }

  @Post(':trackingId/offer/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject the supplier offer (→ back to pending_sourcing)',
  })
  @ApiResponse({ status: 200, type: ShipmentDetailDto })
  @ApiResponse({ status: 409, description: 'No offer is waiting' })
  async rejectOffer(
    @CurrentUser() user: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.shipmentsService.rejectOffer(user.id, trackingId);
  }

  @Post(':trackingId/payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit the (demo) payment (→ pending_payment_confirmation)',
  })
  @ApiResponse({ status: 200, type: ShipmentDetailDto })
  @ApiResponse({ status: 409, description: 'Not waiting for payment' })
  async submitPayment(
    @CurrentUser() user: RequestUser,
    @Param('trackingId') trackingId: string,
    @Body() dto: SubmitPaymentDto,
  ) {
    return this.shipmentsService.submitPayment(user.id, trackingId, dto);
  }

  @Get(':trackingId/events')
  @ApiOperation({ summary: "The shipment's timeline, newest first" })
  @ApiResponse({ status: 200, type: [ShipmentEventDto] })
  async listEvents(
    @CurrentUser() user: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.shipmentsService.listEvents(trackingId, user.id);
  }

  @Get(':trackingId/files')
  @ApiOperation({
    summary: 'Package photos, proof of delivery and other files, newest first',
  })
  @ApiResponse({ status: 200, type: [ShipmentFileDto] })
  async listFiles(
    @CurrentUser() user: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.shipmentsService.listFiles(trackingId, user.id);
  }

  @Delete(':trackingId/files/:fileId')
  @ApiOperation({
    summary:
      'Remove one of your own request photos (only while pending_sourcing, never the last one with no product link)',
  })
  @ApiResponse({ status: 404, description: "Not found, or not the caller's" })
  @ApiResponse({ status: 409, description: "Can't be deleted right now" })
  async deleteFile(
    @CurrentUser() user: RequestUser,
    @Param('trackingId') trackingId: string,
    @Param('fileId') fileId: string,
  ) {
    await this.shipmentsService.deleteOwnFile(user.id, trackingId, fileId);
    return { message: 'File removed' };
  }
}
