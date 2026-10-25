import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PartnerApi } from './decorators/partner-api.decorator';
import { CurrentPartner } from './decorators/current-partner.decorator';
import { PartnerContext } from './types/partner-context';
import { PartnerKeyDto } from './dto/partner-key.dto';

/**
 * The public API for partner systems, under /api/v1: an X-API-Key instead
 * of a login token, and everything scoped to the key's branch.
 */
@ApiTags('Public API')
@PartnerApi()
@Controller('v1')
export class PartnerController {
  @Get('me')
  @ApiOperation({
    summary:
      'Which key this is and which branch it acts for: a quick way to check a key',
  })
  @ApiResponse({ status: 200, type: PartnerKeyDto })
  me(@CurrentPartner() partner: PartnerContext): PartnerKeyDto {
    return {
      keyId: partner.id,
      name: partner.name,
      branch: { id: partner.organizationId, name: partner.organizationName },
      internal: partner.isInternal,
    };
  }
}
