import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bootstrap keeps the unparsed request body.
 *
 * `SanityWebhookGuard` verifies an HMAC over the bytes Sanity sent. Only
 * `rawBody: true` at `NestFactory.create` makes them available: it installs a
 * `verify` hook on the body parser, which keeps a reference to the buffer the
 * parser had already read. Without it `req.rawBody` is undefined, and verifying
 * a re-encoded body would fail on any input whose JSON encoding differs by a
 * space.
 *
 * Pinned because the guard's fallback is to refuse, so dropping this line turns
 * every webhook delivery into a 401 - a failure that reads like a wrong secret
 * and is not.
 */
const MAIN = join(__dirname, '..', '..', 'main.ts');

/** A declaration, not a mention: the option opens its own line. */
const DECLARES_RAW_BODY = /^[ \t]*rawBody:[ \t]*true[ \t]*,?[ \t]*$/m;

describe('the API captures the raw request body', () => {
  const source = readFileSync(MAIN, 'utf8');

  /** A guard that reads the wrong file passes for the wrong reason. */
  it('is reading apps/api/src/main.ts', () => {
    expect(source).toContain('NestFactory.create(AppModule');
  });

  it('passes rawBody: true to NestFactory.create', () => {
    expect(source).toMatch(DECLARES_RAW_BODY);
  });

  it('does not disable the body parser, which rawBody depends on', () => {
    // `bodyParser: false` removes the parser the verify hook is attached to, so
    // rawBody silently stops being populated while the option above still reads
    // as if it were in force.
    expect(source).not.toMatch(/^[ \t]*bodyParser:[ \t]*false/m);
  });
});
