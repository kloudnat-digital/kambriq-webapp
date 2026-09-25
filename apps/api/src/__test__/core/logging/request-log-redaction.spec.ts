import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import { REQUEST_LOG_REDACT_PATHS } from '../../../core/logging/request-log-redaction';

/**
 * A46 - what the request logger writes, read back from the line it wrote.
 *
 * A real request goes through `pino-http` configured with the paths
 * `app.module.ts` registers, and the assertions read the serialized line - the
 * same bytes CloudWatch receives. Each credential has its own test, so each can
 * be seen failing on its own when its path is removed.
 */
const BEARER = 'Bearer a46.header.value-that-must-not-be-logged';
const COOKIE = 'session=a46-cookie-value-that-must-not-be-logged';
const SET_COOKIE = 'refresh=a46-set-cookie-value-that-must-not-be-logged; HttpOnly';
const CALLER_SECRET = 'a46-caller-secret-value-that-must-not-be-logged-0123';

describe('A46 - no credential reaches a request log line', () => {
  let server: Server;
  let line = '';

  beforeAll(async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pinoHttp(
      { redact: { paths: REQUEST_LOG_REDACT_PATHS, censor: '[redacted]' } },
      sink,
    );
    server = createServer((req, res) => {
      logger(req, res);
      res.setHeader('set-cookie', SET_COOKIE);
      res.end('ok');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    await fetch(`http://127.0.0.1:${port}/api/v1/users/me`, {
      headers: {
        authorization: BEARER,
        cookie: COOKIE,
        'x-kambriq-caller-secret': CALLER_SECRET,
        'user-agent': 'a46-test',
      },
    });
    await new Promise((r) => setTimeout(r, 50));
    line = lines.join('');
  });

  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it('wrote the request line it is checking', () => {
    // An empty log passes every "does not contain" below.
    expect(line).toContain('/api/v1/users/me');
    expect(line).toContain('a46-test');
  });

  it('never writes the authorization header', () => {
    expect(line).not.toContain(BEARER);
  });

  it('never writes the cookie header', () => {
    expect(line).not.toContain(COOKIE);
  });

  it('never writes a cookie the response sets', () => {
    expect(line).not.toContain('a46-set-cookie-value');
  });

  it('never writes the caller secret', () => {
    expect(line).not.toContain(CALLER_SECRET);
  });
});
