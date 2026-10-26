import { ApiProperty } from '@nestjs/swagger';
import { ShipmentActorType } from '../../shipments/constants/shipment-actor';
import { ShipmentState } from '../../shipments/constants/shipment-state';
import { ShipmentBranchDto } from '../../shipments/dto/shipment.dto';

export class StatsPeriodDto {
  @ApiProperty({ type: Date })
  from!: Date;

  @ApiProperty({ type: Date, description: 'Excluded' })
  to!: Date;

  @ApiProperty({
    type: Date,
    description: 'Start of the previous period, which ends at `from`',
  })
  previousFrom!: Date;
}

/** One number for the period asked, and the same for the one before it. */
export class PeriodCountDto {
  @ApiProperty({ example: 4 })
  current!: number;

  @ApiProperty({ example: 2 })
  previous!: number;
}

export class ActivityActorDto {
  @ApiProperty({ enum: ShipmentActorType })
  type!: ShipmentActorType;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'A User, InternalUser or ApiKey id; null for the carrier',
  })
  id!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Nadia Haddad',
    description:
      "The person's name, or the API key's for a partner; null for the carrier, or an account that's gone",
  })
  name!: string | null;

  @ApiProperty({
    type: ShipmentBranchDto,
    nullable: true,
    description: "A partner's branch (its API key's); null otherwise",
  })
  organization!: ShipmentBranchDto | null;
}

/** One shipment event, with who did it. */
export class ActivityDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'TRK-4A6F90' })
  trackingId!: string;

  @ApiProperty({ enum: ShipmentState })
  status!: ShipmentState;

  @ApiProperty({ example: 'Lyon hub' })
  location!: string;

  @ApiProperty({ type: Date })
  occurredAt!: Date;

  @ApiProperty({
    type: ActivityActorDto,
    nullable: true,
    description: 'Null on events from before who did it was recorded',
  })
  actor!: ActivityActorDto | null;
}

/** GET /admin/stats/overview. */
export class OverviewStatsDto {
  @ApiProperty({ type: StatsPeriodDto })
  period!: StatsPeriodDto;

  @ApiProperty({
    type: PeriodCountDto,
    description: 'Shipments created in the period (requests and partner ones)',
  })
  created!: PeriodCountDto;

  @ApiProperty({
    type: PeriodCountDto,
    description: 'Shipments delivered in the period',
  })
  delivered!: PeriodCountDto;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    description:
      'How many shipments are in each status now, every status listed',
    example: {
      [ShipmentState.PENDING_SOURCING]: 3,
      [ShipmentState.IN_TRANSIT]: 7,
    },
  })
  byStatus!: Record<ShipmentState, number>;

  @ApiProperty({
    type: [ActivityDto],
    description:
      'The latest shipment events, newest first, whatever the period',
  })
  recentActivity!: ActivityDto[];
}
