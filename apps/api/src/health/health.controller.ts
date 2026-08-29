import { Public } from '@kambriq/common';
import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly corePrisma: CorePrismaService,
    private readonly kbsPrisma: KbsPrismaService,
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
}
