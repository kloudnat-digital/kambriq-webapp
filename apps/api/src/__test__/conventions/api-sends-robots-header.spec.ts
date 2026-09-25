import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Controller, Get, UnauthorizedException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NOINDEX_HEADER, robotsHeaderMiddleware } from '@kambriq/common';

/**
 * P4 - the API carries `X-Robots-Tag` on every response, not only on the ones
 * a handler writes.
 *
 * On dev the header was on every web route and absent from
 * `/api/v1/health/version`. An interceptor would not have closed that: it
 * never runs for a route that does not exist, nor for a request a guard
 * refuses. So the header is set by Express middleware registered before
 * routing, and this file proves the two halves separately:
 *
 * 1. registered that way, the middleware reaches a 200, a 404 and a 401;
 * 2. `main.ts` does register it that way.
 */
@Controller()
class ProbeController {
  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Get('refused')
  refused() {
    throw new UnauthorizedException();
  }
}

describe('P4 - X-Robots-Tag on API responses', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.use(robotsHeaderMiddleware({} as NodeJS.ProcessEnv));
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['a route that answers', '/api/ok', 200],
    ['a route that does not exist', '/api/no-such-route', 404],
    ['a request that is refused', '/api/refused', 401],
  ])('reaches %s', async (_label, path, status) => {
    const response = await fetch(`${base}${path}`);
    expect(response.status).toBe(status);
    expect(response.headers.get('x-robots-tag')).toBe(NOINDEX_HEADER);
  });
});

describe('P4 - main.ts registers the header before routing', () => {
  const MAIN = readFileSync(join(__dirname, '../../main.ts'), 'utf8');

  it('registers robotsHeaderMiddleware on the app', () => {
    expect(MAIN).toMatch(/^\s*app\.use\(robotsHeaderMiddleware\(\)\);$/m);
  });

  it('registers it before the global prefix, so every route is behind it', () => {
    const use = MAIN.search(/^\s*app\.use\(robotsHeaderMiddleware\(\)\);$/m);
    const prefix = MAIN.search(/app\.setGlobalPrefix\(/);
    expect(prefix).toBeGreaterThan(-1);
    expect(use).toBeGreaterThan(-1);
    expect(use).toBeLessThan(prefix);
  });
});
