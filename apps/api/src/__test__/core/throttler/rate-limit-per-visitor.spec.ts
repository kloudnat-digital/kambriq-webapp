import { Controller, Get, type INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from '../../../core/throttler/throttler-behind-proxy.guard';

/**
 * A45 - a rate limit counts per VISITOR, over real HTTP, through the real guard.
 *
 * Measured on dev on 23 September: every call the web server makes on a
 * visitor's behalf reaches the API with `X-Forwarded-For: <web task's public
 * IP>` - one hop, appended by the ALB, and a different address after every
 * deploy. The guard keys on that last hop, so every visitor's login, register,
 * contact and newsletter call spent ONE bucket per route: the web task's.
 *
 * The web now vouches for the visitor with a secret only the web and the API
 * hold. These requests are shaped exactly as they arrive at the API: the ALB's
 * `X-Forwarded-For` with the web's address last, plus the two headers the web
 * adds.
 */
const SECRET = 'a45-test-secret-0123456789abcdef0123456789abcdef';
const WEB_TASK = '3.71.109.10';
const VISITOR_A = '198.51.100.21';
const VISITOR_B = '203.0.113.42';
const ATTACKER = '192.0.2.77';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

describe('A45 - rate limits count per visitor', () => {
  let app: INestApplication;
  let base: string;
  const previous = process.env['WEB_CALLER_SECRET'];

  beforeAll(async () => {
    process.env['WEB_CALLER_SECRET'] = SECRET;
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [PingController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerBehindProxyGuard }],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
    if (previous === undefined) delete process.env['WEB_CALLER_SECRET'];
    else process.env['WEB_CALLER_SECRET'] = previous;
  });

  /** A call the web server makes for a visitor, as the ALB delivers it. */
  const viaWeb = (visitor: string, secret = SECRET) =>
    fetch(`${base}/ping`, {
      headers: {
        'x-forwarded-for': WEB_TASK,
        'x-kambriq-caller-secret': secret,
        'x-kambriq-visitor-ip': visitor,
      },
    }).then((r) => r.status);

  /** A call made straight to the API, as the ALB delivers it. */
  const direct = (from: string, extra: Record<string, string> = {}) =>
    fetch(`${base}/ping`, { headers: { 'x-forwarded-for': from, ...extra } }).then((r) => r.status);

  it('one visitor exceeding the limit leaves another visitor untouched', async () => {
    expect([await viaWeb(VISITOR_A), await viaWeb(VISITOR_A), await viaWeb(VISITOR_A)]).toEqual([
      200, 200, 429,
    ]);
    expect(await viaWeb(VISITOR_B)).toBe(200);
  });

  it('ignores a visitor address claimed without the secret, and counts the caller', async () => {
    // Three different claimed visitors from one direct caller: had any claim
    // been believed, each would have had a fresh bucket and none would be 429.
    const statuses = [];
    for (const claimed of ['10.9.9.1', '10.9.9.2', '10.9.9.3']) {
      statuses.push(await direct(ATTACKER, { 'x-kambriq-visitor-ip': claimed }));
    }
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('ignores a visitor address vouched for with the wrong secret', async () => {
    const statuses = [];
    for (const claimed of ['10.8.8.1', '10.8.8.2', '10.8.8.3']) {
      statuses.push(
        await direct('192.0.2.88', {
          'x-kambriq-caller-secret': 'not-the-secret-not-the-secret-not-the-secret!',
          'x-kambriq-visitor-ip': claimed,
        }),
      );
    }
    expect(statuses).toEqual([200, 200, 429]);
  });

  it('still counts a direct caller by the address the ALB saw, as before', async () => {
    expect([
      await direct('192.0.2.99'),
      await direct('192.0.2.99'),
      await direct('192.0.2.99'),
    ]).toEqual([200, 200, 429]);
    expect(await direct('192.0.2.100')).toBe(200);
  });
});
