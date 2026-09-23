import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalExceptionFilter, PrismaExceptionFilter, ZodExceptionFilter } from '@kambriq/common';
import { DiskHealthIndicator, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';

import { HealthController } from '../../health/health.controller';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { KbsPrismaService } from '../../kbs/prisma/kbs-prisma.service';
import { QueueHealthService } from '../../health/queue-health.service';

/**
 * Readiness is read as a status code, by two `curl -f` callers.
 *
 * The route answered HTTP 200 with `{ status: 'error' }` when the database was
 * unreachable, and its own `@ApiResponse` promised 503. `curl -f` fails only on
 * 4xx and above, so the container health check in `docker/Dockerfile.api` and
 * the deploy gate in `deploy-dev.yml` both read a database outage as ready.
 *
 * The assertion has to be over real HTTP. A thrown `ServiceUnavailableException`
 * is not the same claim as a 503 reaching the client - `PrismaExceptionFilter`
 * is `@Catch()` and already turned every error response into an HTML page once.
 */
const query = jest.fn();

describe('the readiness probe answers with a status code a health check can read', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: MemoryHealthIndicator, useValue: {} },
        { provide: DiskHealthIndicator, useValue: {} },
        { provide: CorePrismaService, useValue: { $queryRawUnsafe: query } },
        { provide: KbsPrismaService, useValue: {} },
        { provide: QueueHealthService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useLogger(false);
    // The same order main.ts uses, so the response is the one a client gets.
    app.useGlobalFilters(
      new GlobalExceptionFilter(),
      new PrismaExceptionFilter(),
      new ZodExceptionFilter(),
    );
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('answers 200 when the core database replies', async () => {
    query.mockResolvedValueOnce([{ '?column?': 1 }]);

    const res = await fetch(`${base}/health/ready`);

    expect(res.status).toBe(200);
    // The envelope is applied by a global interceptor that main.ts registers and
    // this module does not, so the body here is the controller's own return.
    expect(await res.json()).toMatchObject({ status: 'ok' });
  });

  it('answers 503 when the core database does not', async () => {
    query.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await fetch(`${base}/health/ready`);

    expect(res.status).toBe(503);
  });

  it('answers a status curl -f treats as a failure', async () => {
    // The property both callers actually rely on, stated as they rely on it.
    query.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await fetch(`${base}/health/ready`);

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
