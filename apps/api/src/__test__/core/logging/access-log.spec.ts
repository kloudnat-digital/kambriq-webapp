import { readFileSync } from 'node:fs';
import { createServer, request, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import { accessLogProps, accessLogSerializers } from '../../../core/logging/access-log';
import { CALLER_SECRET_HEADER, VISITOR_IP_HEADER } from '../../../core/throttler/caller-identity';

const SECRET = 'x'.repeat(40);

/**
 * D28 - the API's request line, through the real pino-http over a real socket:
 * who (visitor address, account), what (method, masked URL), when, and never a
 * token or a password from the URL or the referer.
 */
const serve = async (user?: { id: string }, params?: Record<string, unknown>) => {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(chunk.toString());
      done();
    },
  });
  const log = pinoHttp(
    { serializers: accessLogSerializers, customProps: accessLogProps(SECRET) },
    stream,
  );
  const server: Server = createServer((req, res) => {
    if (user) (req as unknown as { user: unknown }).user = user;
    // Express populates `req.params` from the matched route, and pino-http's
    // serializer emits it. Set here the same way, so this is the real path.
    if (params) (req as unknown as { params: unknown }).params = params;
    log(req, res);
    res.end('ok');
  });
  await new Promise<void>((r) => server.listen(0, r));
  const call = (path: string, headers: Record<string, string> = {}) =>
    new Promise<void>((resolve) => {
      const { port } = server.address() as AddressInfo;
      request({ port, path, headers }, (res) => res.resume().on('end', resolve)).end();
    });
  return { lines, call, close: () => new Promise((r) => server.close(r)) };
};

describe('D28 - the API request line says who, and never what it must not', () => {
  it('writes no token or password from the URL, the query or the referer', async () => {
    const s = await serve();
    await s.call('/api/v1/auth/verify-email?token=SECRET-TOKEN-1&page=2', {
      referer: 'https://dev.kambriq.com/fr/reset-password?token=SECRET-TOKEN-2',
    });
    await s.call('/api/v1/auth/login?password=SECRET-PASSWORD-3');
    await s.close();

    const all = s.lines.join('\n');
    expect(all).not.toMatch(/SECRET-TOKEN-1|SECRET-TOKEN-2|SECRET-PASSWORD-3/);
    const first = JSON.parse(s.lines[0]);
    expect(first.req.url).toBe('/api/v1/auth/verify-email?token=[redacted]&page=2');
    expect(first.req.headers.referer).toBe(
      'https://dev.kambriq.com/fr/reset-password?token=[redacted]',
    );
  });

  it('writes no route parameter it was not asked to write', async () => {
    // pino-http's serializer emits `params` and the spread copied it unmasked.
    // Masked by the same allowlist as the query.
    const s = await serve(undefined, { token: 'SECRET-IN-A-PARAM', page: '2' });
    await s.call('/api/v1/probe/anything');
    await s.close();

    const line = JSON.parse(s.lines[0]);
    expect(line.req.params).toEqual({ token: '[redacted]', page: '2' });
    expect(s.lines.join('\n')).not.toContain('SECRET-IN-A-PARAM');
  });

  it('logs the path in full, which is the bound on all of this', async () => {
    // `maskUrl` masks the query and the fragment and NOT the path, because a
    // path cannot be told from a credential by looking at it and the path is
    // what an access log is for. So masking `params` is defence in depth, not a
    // closed hole: a secret in a path segment is written by `url` regardless.
    // What closes it is `no-credential-in-a-route-path.spec.ts`, which stops the
    // route existing.
    const s = await serve();
    await s.call('/api/v1/probe/VALUE-IN-THE-PATH?token=SECRET');
    await s.close();

    const line = JSON.parse(s.lines[0]);
    expect(line.req.url).toBe('/api/v1/probe/VALUE-IN-THE-PATH?token=[redacted]');
  });

  it('names the visitor the web vouched for, not the web server', async () => {
    const s = await serve();
    await s.call('/api/v1/lands?limit=50', {
      'x-forwarded-for': '198.51.100.7',
      [VISITOR_IP_HEADER]: '203.0.113.9',
      [CALLER_SECRET_HEADER]: SECRET,
    });
    await s.close();
    expect(JSON.parse(s.lines[0]).visitorIp).toBe('203.0.113.9');
  });

  it('falls back to the address the load balancer saw when nobody vouches', async () => {
    const s = await serve();
    await s.call('/api/v1/lands', { 'x-forwarded-for': '198.51.100.7' });
    await s.close();
    expect(JSON.parse(s.lines[0]).visitorIp).toBe('198.51.100.7');
  });

  it('names the signed-in account', async () => {
    const s = await serve({ id: 'user-42' });
    await s.call('/api/v1/lands');
    await s.close();
    expect(JSON.parse(s.lines[0]).userId).toBe('user-42');
  });

  it('is wired into the API logger', () => {
    const src = readFileSync(join(__dirname, '../../../app/app.module.ts'), 'utf8');
    expect(src).toMatch(/serializers:\s*accessLogSerializers/);
    expect(src).toMatch(/accessLogProps\(/);
  });
});
