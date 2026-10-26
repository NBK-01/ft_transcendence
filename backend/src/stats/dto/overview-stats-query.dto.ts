import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { MAX_RANGE_DAYS } from '../stats.constants';
import { IsRangeEnd } from '../validators/is-range-end.validator';

/**
 * GET /admin/stats/overview. The browser sends the period, so "today" is the
 * user's day, not the server's.
 */
export class OverviewStatsQueryDto {
  @ApiProperty({
    format: 'date-time',
    example: '2026-10-26T00:00:00+02:00',
    description: 'Start of the period (included)',
  })
  @IsISO8601({ strict: true })
  from!: string;

  @ApiProperty({
    format: 'date-time',
    example: '2026-10-27T00:00:00+02:00',
    description: `End of the period (excluded): after \`from\`, at most ${MAX_RANGE_DAYS} days later. The previous period is as long, just before \`from\``,
  })
  @IsISO8601({ strict: true })
  @IsRangeEnd('from', MAX_RANGE_DAYS)
  to!: string;

  @ApiProperty({
    required: false,
    format: 'uuid',
    description:
      "Only this branch's shipments. Customer orders have no branch, so they never count",
  })
  @IsOptional()
  @IsUUID()
  organizationId?: string;
}
