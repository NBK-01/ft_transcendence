import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import {
  RequireAnyPermission,
  RequirePermission,
} from '../common/decorators/access-control.decorator';
import { AssignBranchDto } from './dto/assign-branch.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/context/auth-context.types';
import { MissingRequiredDataException } from '../common/exceptions/validation-exceptions';
import { AdminShipmentsService } from './admin-shipments.service';
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

/** Staff who read every shipment, or only their own branch's (see AccessControlService.branchScope). */
const READ_PERMISSIONS = ['shipments:read:all', 'shipments:read:org'];

/**
 * Staff side of shipments. Admins and support (shipments:read:all) work on
 * every shipment; a dispatcher (shipments:read:org) only on their branch's,
 * which a partner created or an admin assigned (PATCH :trackingId/branch).
 * Changes need shipments:update:org, within the same scope.
 */
@ApiTags('Admin shipments')
@ApiBearerAuth()
@Controller('admin/shipments')
export class AdminShipmentsController {
  constructor(private readonly adminShipmentsService: AdminShipmentsService) {}

  @RequireAnyPermission(READ_PERMISSIONS)
  @Get()
  @ApiOperation({
    summary:
      'List shipments, most recently updated first (filter status=pending_sourcing for the sourcing queue)',
    description:
      "Every shipment with shipments:read:all; with shipments:read:org (a dispatcher), only their branch's, whatever organizationId says.",
  })
  async list(
    @CurrentUser() staff: RequestUser,
    @Query() query: ListAdminShipmentsQueryDto,
  ) {
    return this.adminShipmentsService.list(staff.id, query);
  }

  @RequireAnyPermission(READ_PERMISSIONS)
  @Get(':trackingId')
  @ApiOperation({ summary: 'Get one shipment, with its client' })
  @ApiResponse({ status: 200, type: AdminShipmentDetailDto })
  @ApiResponse({ status: 404, description: 'Unknown, or outside your branch' })
  async getOne(
    @CurrentUser() staff: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.adminShipmentsService.getDetailFor(staff.id, trackingId);
  }

  @RequireAnyPermission(READ_PERMISSIONS)
  @Get(':trackingId/events')
  @ApiOperation({ summary: "The shipment's timeline, newest first" })
  @ApiResponse({ status: 200, type: [ShipmentEventDto] })
  async listEvents(
    @CurrentUser() staff: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.adminShipmentsService.listEvents(staff.id, trackingId);
  }

  @RequireAnyPermission(READ_PERMISSIONS)
  @Get(':trackingId/files')
  @ApiOperation({ summary: "The shipment's attachments, newest first" })
  @ApiResponse({ status: 200, type: [ShipmentFileDto] })
  async listFiles(
    @CurrentUser() staff: RequestUser,
    @Param('trackingId') trackingId: string,
  ) {
    return this.adminShipmentsService.listFiles(staff.id, trackingId);
  }

  @RequirePermission('organizations:manage')
  @Patch(':trackingId/branch')
  @ApiOperation({
    summary: "Hand a customer's order to a branch, or take it off one (null)",
  })
  @ApiResponse({ status: 200, type: AdminShipmentDetailDto })
  @ApiResponse({
    status: 409,
    description:
      "A partner's shipment, which stays with its branch (3008), or a deactivated branch (4005)",
  })
  async assignBranch(
    @Param('trackingId') trackingId: string,
    @Body() dto: AssignBranchDto,
  ) {
    return this.adminShipmentsService.assignBranch(
      trackingId,
      dto.organizationId,
    );
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
    @CurrentUser() staff: RequestUser,
    @Param('trackingId') trackingId: string,
    @Body() dto: UploadFileDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new MissingRequiredDataException('file');
    }
    return this.adminShipmentsService.uploadFile(
      staff.id,
      trackingId,
      dto,
      file,
    );
  }
}
