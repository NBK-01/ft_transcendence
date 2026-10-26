import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsSelect,
  FindOptionsWhere,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { InternalUser } from '../internal-users/internal-user.entity';
import { ApiKey } from '../public-api/entities/api-key.entity';
import { ShipmentActorType } from '../shipments/constants/shipment-actor';
import { ShipmentState } from '../shipments/constants/shipment-state';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { User } from '../users/user.entity';
import { OverviewStatsQueryDto } from './dto/overview-stats-query.dto';
import {
  ActivityDto,
  OverviewStatsDto,
  PeriodCountDto,
} from './dto/overview-stats.dto';
import { ActivityFactory, ActorDirectory } from './factories/activity.factory';
import { RECENT_ACTIVITY_LIMIT } from './stats.constants';

/** The period asked, the one before it (same length, ending at `from`), and the branch. */
interface Range {
  from: Date;
  to: Date;
  previousFrom: Date;
  organizationId?: string;
}

/**
 * The admin overview's shipment numbers, read-only. Counts are done by
 * Postgres (COUNT … FILTER, GROUP BY), so they cost one query each however
 * many shipments there are.
 */
@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Shipment)
    private readonly shipmentRepository: Repository<Shipment>,
    @InjectRepository(ShipmentEvent)
    private readonly eventRepository: Repository<ShipmentEvent>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(InternalUser)
    private readonly internalUserRepository: Repository<InternalUser>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async overview(query: OverviewStatsQueryDto): Promise<OverviewStatsDto> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    const previousFrom = new Date(2 * from.getTime() - to.getTime());
    const range: Range = {
      from,
      to,
      previousFrom,
      organizationId: query.organizationId,
    };

    const [created, delivered, byStatus, recentActivity] = await Promise.all([
      this.countCreated(range),
      this.countDelivered(range),
      this.countByStatus(query.organizationId),
      this.recentActivity(query.organizationId),
    ]);
    return {
      period: { from, to, previousFrom },
      created,
      delivered,
      byStatus,
      recentActivity,
    };
  }

  /** Shipments whose createdAt falls in the period, and in the one before. */
  private countCreated(range: Range): Promise<PeriodCountDto> {
    const qb = this.shipmentRepository.createQueryBuilder('shipment');
    this.forBranch(qb, range.organizationId);
    return this.countInPeriods(qb, '"shipment"."created_at"', range);
  }

  /** Delivered events in the period, and in the one before: delivered is final, so one per shipment. */
  private countDelivered(range: Range): Promise<PeriodCountDto> {
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .innerJoin('event.shipment', 'shipment')
      .where('event.status = :delivered', {
        delivered: ShipmentState.DELIVERED,
      });
    this.forBranch(qb, range.organizationId);
    return this.countInPeriods(qb, '"event"."created_at"', range);
  }

  /** Every status, at 0 when no shipment is in it. */
  private async countByStatus(
    organizationId?: string,
  ): Promise<Record<ShipmentState, number>> {
    const qb = this.shipmentRepository
      .createQueryBuilder('shipment')
      .select('shipment.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('shipment.status');
    this.forBranch(qb, organizationId);
    const rows = await qb.getRawMany<{
      status: ShipmentState;
      count: string;
    }>();

    const counts = Object.fromEntries(
      Object.values(ShipmentState).map((status) => [status, 0]),
    ) as Record<ShipmentState, number>;
    for (const row of rows) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  /** The newest events, whatever the period, with who did each. */
  private async recentActivity(
    organizationId?: string,
  ): Promise<ActivityDto[]> {
    const qb = this.eventRepository
      .createQueryBuilder('event')
      .innerJoin('event.shipment', 'shipment')
      .addSelect(['shipment.id', 'shipment.trackingId'])
      .orderBy('event.createdAt', 'DESC')
      .addOrderBy('event.id', 'DESC')
      // limit, not take: one shipment per event, so no rows to de-duplicate.
      .limit(RECENT_ACTIVITY_LIMIT);
    this.forBranch(qb, organizationId);
    const events = await qb.getMany();
    const directory = await this.actorDirectory(events);
    return events.map((event) => ActivityFactory.toDto(event, directory));
  }

  /** The names behind the events' actors: one query per kind that appears. */
  private async actorDirectory(
    events: ShipmentEvent[],
  ): Promise<ActorDirectory> {
    const idsOf = (type: ShipmentActorType) => [
      ...new Set(
        events
          .filter((event) => event.actorType === type && event.actorId)
          .map((event) => event.actorId!),
      ),
    ];
    const [customers, staff, apiKeys] = await Promise.all([
      this.namesById(this.userRepository, idsOf(ShipmentActorType.CUSTOMER)),
      this.namesById(
        this.internalUserRepository,
        idsOf(ShipmentActorType.STAFF),
      ),
      this.apiKeysById(idsOf(ShipmentActorType.PARTNER)),
    ]);
    return { customers, staff, apiKeys };
  }

  /** id → name for these customers or staff members; no query for none. */
  private async namesById<T extends { id: string; name: string }>(
    repository: Repository<T>,
    ids: string[],
  ): Promise<Map<string, string>> {
    if (!ids.length) {
      return new Map();
    }
    const rows = await repository.find({
      where: { id: In(ids) } as FindOptionsWhere<T>,
      select: { id: true, name: true } as FindOptionsSelect<T>,
    });
    return new Map(rows.map((row) => [row.id, row.name]));
  }

  /** id → API key, with its branch; no query for none. */
  private async apiKeysById(ids: string[]): Promise<Map<string, ApiKey>> {
    if (!ids.length) {
      return new Map();
    }
    const keys = await this.apiKeyRepository.find({
      where: { id: In(ids) },
      relations: { organization: true },
    });
    return new Map(keys.map((key) => [key.id, key]));
  }

  /**
   * Counts `qb`'s rows whose `column` is in the period and in the one before,
   * in one query. `column` is a raw, quoted column ("alias"."column_name").
   */
  private async countInPeriods(
    qb: SelectQueryBuilder<Shipment> | SelectQueryBuilder<ShipmentEvent>,
    column: string,
    { from, to, previousFrom }: Range,
  ): Promise<PeriodCountDto> {
    const row = await qb
      .select(`COUNT(*) FILTER (WHERE ${column} >= :from)`, 'current')
      .addSelect(`COUNT(*) FILTER (WHERE ${column} < :from)`, 'previous')
      .andWhere(`${column} >= :previousFrom AND ${column} < :to`, {
        from,
        to,
        previousFrom,
      })
      .getRawOne<{ current: string; previous: string }>();
    return {
      current: Number(row?.current ?? 0),
      previous: Number(row?.previous ?? 0),
    };
  }

  /** `qb` must have the shipment joined (or be on it) as `shipment`. */
  private forBranch(
    qb: SelectQueryBuilder<Shipment> | SelectQueryBuilder<ShipmentEvent>,
    organizationId?: string,
  ): void {
    if (organizationId) {
      qb.andWhere('shipment.organizationId = :organizationId', {
        organizationId,
      });
    }
  }
}
