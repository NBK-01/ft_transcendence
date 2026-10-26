import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CarrierSignatureGuard } from './guards/carrier-signature.guard';
import { WebhooksService } from './webhooks.service';
import {
  CARRIER_TRACKING_STATUSES,
  CARRIER_TRACKING_UPDATED,
} from './constants/webhook.constants';

/**
 * Incoming webhooks. No login token (@Public skips the JwtAuthGuard): a
 * provider proves who it is with a signature over the request's bytes.
 */
@ApiTags('Webhooks')
@Public()
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('carrier')
  @HttpCode(HttpStatus.OK)
  @UseGuards(CarrierSignatureGuard)
  @ApiOperation({
    summary:
      "A carrier's tracking update, signed. Stored, then applied once (redeliveries are logged as duplicates)",
  })
  @ApiHeader({
    name: 'Carrier-Signature',
    required: true,
    description:
      't={unix seconds},v1={hex HMAC-SHA256 of "{t}.{raw body}" with CARRIER_WEBHOOK_SECRET}; within 5 minutes of now',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['eventId', 'type', 'data'],
      properties: {
        eventId: { type: 'string', example: 'evt_01J9ZQ' },
        type: { type: 'string', example: CARRIER_TRACKING_UPDATED },
        data: {
          type: 'object',
          properties: {
            trackingId: { type: 'string', example: 'TRK-4A6F90' },
            status: { type: 'string', enum: [...CARRIER_TRACKING_STATUSES] },
            location: { type: 'string', example: 'Lyon hub' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description:
      '{ received: true }, plus duplicate: true for a redelivery or ignored: true for an event type we don’t use',
  })
  @ApiResponse({ status: 400, description: 'Unreadable body (6004)' })
  @ApiResponse({ status: 401, description: 'Bad or stale signature (6002)' })
  @ApiResponse({
    status: 503,
    description: 'CARRIER_WEBHOOK_SECRET not set (6003): retry later',
  })
  async receiveCarrierEvent(@Body() body: unknown) {
    return this.webhooksService.receiveCarrierEvent(body);
  }
}
