import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

const HEAP_LIMIT_BYTES = 300 * 1024 * 1024;
const RSS_LIMIT_BYTES = 300 * 1024 * 1024;

@ApiExcludeController()
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get('live')
  @HttpCode(HttpStatus.OK)
  live(): { status: 'ok' } {
    // Process is up and handling requests — no dependency checks.
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
    ]);
  }

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 1500 }),
      () => this.memory.checkHeap('memory_heap', HEAP_LIMIT_BYTES),
      () => this.memory.checkRSS('memory_rss', RSS_LIMIT_BYTES),
    ]);
  }
}
