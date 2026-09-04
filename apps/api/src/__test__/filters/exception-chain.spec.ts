import {
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Module,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { GlobalExceptionFilter, PrismaExceptionFilter, ZodExceptionFilter } from '@kambriq/common';

/**
 * Tests the filter CHAIN, not a filter.
 *
 * `global-exception.filter.spec.ts` calls the filter directly and passes. It
 * passed throughout the period when the filter never executed once in
 * production: `PrismaExceptionFilter` is also `@Catch()`, Nest selects the
 * last-registered matching filter, and its `throw exception` for non-Prisma
 * errors escaped Nest into Express's default error handler. Every 401, 403 and
 * 404 on dev came back as an HTML page with a full stack trace and no envelope.
 *
 * A unit test of a filter proves the filter. It cannot prove that the filter is
 * reached. This one boots a real HTTP server with the same `useGlobalFilters`
 * wiring as `main.ts` and reads what a client actually receives - which is the
 * only place the defect was ever visible.
 */
@Controller('probe')
class ProbeController {
  @Get('unauthorized')
  unauthorized(): never {
    throw new UnauthorizedException('nope');
  }

  @Get('forbidden')
  forbidden(): never {
    throw new ForbiddenException('nope');
  }

  @Get('not-found')
  notFound(): never {
    throw new NotFoundException('nope');
  }

  @Get('boom')
  boom(): never {
    throw new Error('unhandled, on purpose');
  }

  @Get('prisma')
  prisma(): never {
    // Duck-typed the way PrismaExceptionFilter detects them.
    throw Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['email'] },
    });
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('global filter chain, over real HTTP', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    // Exactly the order main.ts uses.
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

  it.each([
    ['unauthorized', 401],
    ['forbidden', 403],
    ['not-found', 404],
    ['boom', 500],
  ])('GET /probe/%s answers %i as JSON, with the envelope and no stack', async (path, status) => {
    const res = await fetch(`${base}/probe/${path}`);
    const body = await res.text();

    expect(res.status).toBe(status);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);

    // The shape a client is entitled to.
    const json = JSON.parse(body);
    expect(json).toMatchObject({ success: false, statusCode: status });
    expect(json).not.toHaveProperty('stack');

    // The two things that gave the defect away from outside.
    expect(body).not.toContain('<!DOCTYPE html>');
    expect(body).not.toContain('node_modules');
  });

  it('an unmatched URL is JSON too, not Express’s HTML error page', async () => {
    const res = await fetch(`${base}/no-such-route`);
    const body = await res.text();

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(body).not.toContain('node_modules');
    expect(JSON.parse(body)).toMatchObject({ success: false, statusCode: 404 });
  });

  it('still lets the Prisma filter own Prisma errors', async () => {
    const res = await fetch(`${base}/probe/prisma`);
    const json = (await res.json()) as { statusCode: number; message: string };

    expect(res.status).toBe(409); // P2002 -> Conflict
    expect(json.message).toContain('email');
  });
});
