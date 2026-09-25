import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import {
  CALLER_SECRET_HEADER,
  REDACTED_REQUEST_HEADERS,
  VISITOR_IP_HEADER,
  callerSecretMismatch,
  lastForwardedHop,
  readCallerSecret,
  resolveTracker,
} from '../../../core/throttler/caller-identity';

/**
 * A45 - the rules of `resolveTracker`, one expectation each, so each can be
 * mutated and watched failing on its own. The over-HTTP proof is
 * `rate-limit-per-visitor.spec.ts`.
 */
const SECRET = 'a45-unit-secret-0123456789abcdef0123456789abcd';
const WEB = '3.71.109.10';
const VISITOR = '198.51.100.21';

const req = (headers: Record<string, string | string[]>, ip?: string) => ({ headers, ip });
const vouched = (over: Record<string, string | string[]> = {}) =>
  req({
    'x-forwarded-for': WEB,
    [CALLER_SECRET_HEADER]: SECRET,
    [VISITOR_IP_HEADER]: VISITOR,
    ...over,
  });

describe('A45 - resolveTracker', () => {
  it('uses the visitor the web vouched for with the right secret', () => {
    expect(resolveTracker(vouched(), SECRET)).toBe(VISITOR);
  });

  it('accepts an IPv6 visitor', () => {
    expect(resolveTracker(vouched({ [VISITOR_IP_HEADER]: '2001:db8::7' }), SECRET)).toBe(
      '2001:db8::7',
    );
  });

  it('ignores the claim when the API has no secret configured', () => {
    expect(resolveTracker(vouched(), null)).toBe(WEB);
  });

  it('ignores the claim when no secret is sent', () => {
    const headers = { 'x-forwarded-for': WEB, [VISITOR_IP_HEADER]: VISITOR };
    expect(resolveTracker(req(headers), SECRET)).toBe(WEB);
  });

  it('ignores the claim when the secret is wrong', () => {
    expect(resolveTracker(vouched({ [CALLER_SECRET_HEADER]: `${SECRET}x` }), SECRET)).toBe(WEB);
  });

  it('ignores a secret sent twice', () => {
    expect(resolveTracker(vouched({ [CALLER_SECRET_HEADER]: [SECRET, SECRET] }), SECRET)).toBe(WEB);
  });

  it.each([['not-an-address'], ['198.51.100.21, 10.0.0.1'], ['']])(
    'ignores a vouched value that is not one address: %p',
    (value) => {
      expect(resolveTracker(vouched({ [VISITOR_IP_HEADER]: value }), SECRET)).toBe(WEB);
    },
  );

  it('falls back to the last forwarded hop, never an earlier one', () => {
    expect(lastForwardedHop({ 'x-forwarded-for': '10.1.1.1, 192.0.2.5' })).toBe('192.0.2.5');
  });

  it("falls back to the connection's address when nothing is forwarded", () => {
    expect(resolveTracker(req({}, '10.0.1.9'), SECRET)).toBe('10.0.1.9');
  });
});

describe('A45 - a secret that is sent and wrong is a misconfiguration, not a choice', () => {
  /**
   * `vouchedVisitor` answers `null` for three different situations and the
   * throttler treats them alike, which is right for the tracker and wrong for
   * the operator: a rotation applied on one side only silently returns every
   * visitor to one shared bucket - the A2 defect, with nothing to show for it.
   */
  it('is true only when a secret was sent and does not match', () => {
    expect(callerSecretMismatch({ [CALLER_SECRET_HEADER]: 'wrong' }, SECRET)).toBe(true);
  });

  it('is false when nothing was sent, which is an ordinary direct caller', () => {
    expect(callerSecretMismatch({}, SECRET)).toBe(false);
    expect(callerSecretMismatch({ 'x-forwarded-for': '203.0.113.9' }, SECRET)).toBe(false);
  });

  it('is false when the API holds no secret, which is a stated choice', () => {
    // The guard already warns about this one at startup. Reporting it again per
    // request would bury the case that is actually wrong.
    expect(callerSecretMismatch({ [CALLER_SECRET_HEADER]: 'anything' }, null)).toBe(false);
  });

  it('is false when the secret is right, so a working deployment stays quiet', () => {
    expect(callerSecretMismatch({ [CALLER_SECRET_HEADER]: SECRET }, SECRET)).toBe(false);
  });
});

describe('A45 - WEB_CALLER_SECRET', () => {
  it('is optional', () => {
    expect(readCallerSecret({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it('refuses a short secret at startup rather than using it', () => {
    expect(() => readCallerSecret({ WEB_CALLER_SECRET: 'short' } as NodeJS.ProcessEnv)).toThrow(
      'WEB_CALLER_SECRET',
    );
  });
});

describe('A45 - the secret never reaches a log line', () => {
  it('is redacted by pino with the paths the app registers', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk, _enc, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    // pino-http, the layer app.module.ts configures, with the same option.
    const { logger } = pinoHttp(
      { redact: { paths: REDACTED_REQUEST_HEADERS, censor: '[redacted]' } },
      sink,
    );
    logger.info({ req: { headers: { [CALLER_SECRET_HEADER]: SECRET, host: 'x' } } }, 'done');

    expect(lines.join('')).not.toContain(SECRET);
    expect(lines.join('')).toContain('[redacted]');
  });

  it('is registered on the request logger in app.module.ts', () => {
    const module = readFileSync(join(__dirname, '../../../app/app.module.ts'), 'utf8');
    expect(module).toMatch(/redact:\s*\{\s*paths:\s*REQUEST_LOG_REDACT_PATHS/);
  });
});
