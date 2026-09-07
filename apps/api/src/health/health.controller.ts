import { Public, RoleCode, Roles } from '@kambriq/common';
import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { CorePrismaService } from '../core/prisma/core-prisma.service';
import { KbsPrismaService } from '../kbs/prisma/kbs-prisma.service';
import { BuildInfo, getBuildInfo } from './build-info';
import { QueueHealthService } from './queue-health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly corePrisma: CorePrismaService,
    private readonly kbsPrisma: KbsPrismaService,
    private readonly queueHealth: QueueHealthService,
  ) {}

  @Public()
  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Full health check',
    description:
      'Checks database connectivity (core + KBS), memory heap, memory RSS, and disk usage. Returns a detailed status per indicator. Used by load balancers and monitoring tools.',
  })
  @ApiResponse({
    status: 200,
    description: 'All health indicators are healthy.',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more indicators are unhealthy. See response body for details.',
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => {
        try {
          await this.corePrisma.$queryRawUnsafe('SELECT 1');
          return { 'database-core': { status: 'up' } };
        } catch (error) {
          return { 'database-core': { status: 'down', error } };
        }
      },

      // Memory heap < 512MB
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),

      // Memory RSS < 1GB
      () => this.memory.checkRSS('memory_rss', 1024 * 1024 * 1024),

      // Disk usage < 90%
      () => this.disk.checkStorage('disk', { thresholdPercent: 0.9, path: '/' }),

      async () => {
        try {
          const count = await this.kbsPrisma.kbsExamQuestion.count();
          return {
            'database-kbs-exam-questions': {
              status: 'up',
              count,
            },
          };
        } catch (error) {
          return {
            'database-kbs-exam-questions': {
              status: 'down',
              error,
            },
          };
        }
      },
    ]);
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness check',
    description:
      'Lightweight check that verifies core database connectivity. Used by orchestrators (Kubernetes, ECS) to determine if the instance is ready to receive traffic.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is ready. Returns { status: "ok" }.',
  })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready. Core database is unreachable.',
  })
  async ready(): Promise<{ status: string }> {
    try {
      await this.corePrisma.$queryRawUnsafe('SELECT 1');
      return { status: 'ok' };
    } catch {
      return { status: 'error' };
    }
  }

  @Public()
  @Get('version')
  @ApiOperation({
    summary: 'Build and version info',
    description:
      'Returns the build metadata baked into the running image: image tag, commit SHA, build time and process start time. Does not touch the database, so it stays answerable even when a dependency is down. The deploy pipeline polls this after each rollout and fails the deploy if the served imageTag is not the tag it just deployed.',
  })
  @ApiResponse({
    status: 200,
    description: 'Build metadata of the instance serving this request.',
  })
  version(): BuildInfo {
    return getBuildInfo();
  }

  // ----- A18: queue observability ----- //

  @Get('queues')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Per-queue job counts',
    description:
      'waiting, active, completed, failed, delayed and paused, for every queue. ' +
      '**Authenticated**, unlike the three health routes above, which are public: this exposes ' +
      'operational ' +
      'internals, and the companion route exposes failed payloads which carry personal data. ' +
      'A18: `S9` proved an unknown job lands on the failed set rather than vanishing, but that ' +
      'proof was taken locally - on dev the sets live in ElastiCache inside the VPC and nothing ' +
      'could see them. A failure nobody can observe is a silent failure whatever the code ' +
      'guarantees.',
  })
  @ApiResponse({ status: 200, description: 'Counts returned, one entry per queue.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions. Requires ADMIN_GLOBAL.' })
  async queues() {
    return this.queueHealth.counts();
  }

  @Get('queues/:name/failed')
  @Roles(RoleCode.ADMIN_GLOBAL)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '[Admin] Failed jobs of one queue, with their payloads',
    description:
      'Newest first, with `data` intact, `failedReason` and `attemptsMade`. A count says ' +
      'something failed; the payload says what, for whom, and whether it can be replayed. ' +
      '`removeOnFailed: 200` already retains them - this reads them back.',
  })
  @ApiParam({ name: 'name', description: 'Queue name: kbs, core, kamnet or notifications' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Failed jobs returned.' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions. Requires ADMIN_GLOBAL.' })
  @ApiResponse({ status: 404, description: 'No queue by that name.' })
  async failedJobs(@Param('name') name: string, @Query('limit') limit?: string) {
    return this.queueHealth.failed(name, limit ? Number(limit) : 20);
  }
}
