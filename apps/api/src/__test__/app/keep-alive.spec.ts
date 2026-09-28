import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOAD_BALANCER_IDLE_TIMEOUT_MS, outliveTheLoadBalancer } from '../../app/keep-alive';

/**
 * A68 - an idle connection is closed by the load balancer first, never by the
 * API, so the load balancer cannot send a request on a connection the API is
 * closing and answer 502.
 */
describe('A68 - the API outlives the load balancer on an idle connection', () => {
  const server = createServer();
  beforeAll(() => outliveTheLoadBalancer(server));

  it('keeps an idle connection open longer than the load balancer does', () => {
    expect(server.keepAliveTimeout).toBeGreaterThan(LOAD_BALANCER_IDLE_TIMEOUT_MS);
  });

  it('waits for headers longer than it keeps a connection idle, as Node requires', () => {
    expect(server.headersTimeout).toBeGreaterThan(server.keepAliveTimeout);
  });

  it('is applied to the server the API listens on', () => {
    const main = readFileSync(join(__dirname, '..', '..', 'main.ts'), 'utf8');
    expect(main).toMatch(/^\s*outliveTheLoadBalancer\(app\.getHttpServer\(\)\);/m);
  });
});
