import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators/access-control.decorator';
import { OverviewStatsQueryDto } from './dto/overview-stats-query.dto';
import { OverviewStatsDto } from './dto/overview-stats.dto';
import { MAX_RANGE_DAYS } from './stats.constants';
import { StatsService } from './stats.service';

/** Numbers for the admin app's overview. Same read permission as the shipments list. */
@ApiTags('Admin stats')
@ApiBearerAuth()
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @RequirePermission('shipments:read:all')
  @Get('overview')
  @ApiOperation({
    summary:
      'Shipments created and delivered in a period (and the one before), how many are in each status now, and the latest events with who did them',
  })
  @ApiResponse({ status: 200, type: OverviewStatsDto })
  @ApiResponse({
    status: 400,
    description: `from or to missing or not ISO 8601, to not after from, or more than ${MAX_RANGE_DAYS} days apart`,
  })
  @ApiResponse({ status: 403, description: 'No shipments:read:all' })
  async overview(@Query() query: OverviewStatsQueryDto) {
    return this.statsService.overview(query);
  }
}
