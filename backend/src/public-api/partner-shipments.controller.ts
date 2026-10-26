import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ListShipmentsQueryDto } from '../shipments/dto/list-shipments-query.dto';
import { PartnerApi } from './decorators/partner-api.decorator';
import { CurrentPartner } from './decorators/current-partner.decorator';
import { PartnerContext } from './types/partner-context';
import { PartnerShipmentsService } from './partner-shipments.service';
import { CreatePartnerShipmentDto } from './dto/create-partner-shipment.dto';
import { UpdatePartnerShipmentStatusDto } from './dto/update-partner-shipment-status.dto';
import { CancelPartnerShipmentQueryDto } from './dto/cancel-partner-shipment-query.dto';
import {
  PartnerShipmentDetailDto,
  PartnerShipmentDto,
} from './dto/partner-shipment.dto';

/** The key's branch's shipments. Another branch's tracking ID is a 404 (3001). */
@ApiTags('Public API')
@PartnerApi()
@Controller('v1/shipments')
export class PartnerShipmentsController {
  constructor(
    private readonly partnerShipmentsService: PartnerShipmentsService,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      "The branch's shipments, most recently updated first (q: tracking ID search, status filter)",
  })
  @ApiResponse({
    status: 200,
    type: [PartnerShipmentDto],
    description: 'data: one page, meta: pagination',
  })
  async list(
    @CurrentPartner() partner: PartnerContext,
    @Query() query: ListShipmentsQueryDto,
  ) {
    return this.partnerShipmentsService.list(partner, query);
  }

  @Get(':trackingId')
  @ApiOperation({ summary: 'One shipment, with its timeline' })
  @ApiResponse({ status: 200, type: PartnerShipmentDetailDto })
  @ApiResponse({
    status: 404,
    description: "Not this branch's shipment (3001)",
  })
  async get(
    @CurrentPartner() partner: PartnerContext,
    @Param('trackingId') trackingId: string,
  ) {
    return this.partnerShipmentsService.get(partner, trackingId);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a shipment for an existing customer. It starts at confirmed, with its route set',
  })
  @ApiResponse({ status: 201, type: PartnerShipmentDetailDto })
  @ApiResponse({
    status: 404,
    description: 'No customer account with that email (16008)',
  })
  async create(
    @CurrentPartner() partner: PartnerContext,
    @Body() dto: CreatePartnerShipmentDto,
  ) {
    return this.partnerShipmentsService.create(partner, dto);
  }

  @Put(':trackingId/status')
  @ApiOperation({
    summary:
      'Post a tracking update: in_transit, out_for_delivery or delivered, from where it is now',
  })
  @ApiResponse({ status: 200, type: PartnerShipmentDetailDto })
  @ApiResponse({
    status: 404,
    description: "Not this branch's shipment (3001)",
  })
  @ApiResponse({
    status: 409,
    description: 'Not allowed from the current status (3002)',
  })
  async updateStatus(
    @CurrentPartner() partner: PartnerContext,
    @Param('trackingId') trackingId: string,
    @Body() dto: UpdatePartnerShipmentStatusDto,
  ) {
    return this.partnerShipmentsService.updateStatus(partner, trackingId, dto);
  }

  @Delete(':trackingId')
  @ApiOperation({
    summary:
      'Cancel a shipment that is not delivered or cancelled yet. It and its history are kept',
  })
  @ApiResponse({ status: 200, type: PartnerShipmentDetailDto })
  @ApiResponse({
    status: 404,
    description: "Not this branch's shipment (3001)",
  })
  @ApiResponse({
    status: 409,
    description: 'Already delivered or cancelled (3002)',
  })
  async cancel(
    @CurrentPartner() partner: PartnerContext,
    @Param('trackingId') trackingId: string,
    @Query() query: CancelPartnerShipmentQueryDto,
  ) {
    return this.partnerShipmentsService.cancel(
      partner,
      trackingId,
      query.reason,
    );
  }
}
