import { Reflector } from '@nestjs/core';
import type { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { ThrottlerBehindProxyGuard } from '../../../core/throttler/throttler-behind-proxy.guard';

/**
 * A36 - the guard that decides who owns a throttle bucket, finally tested.
 *
 * `getTracker` had no test at all: one occurrence in the whole of `apps/api`,
 * its own definition. It is the function that answers "whose quota is this
 * request spending", and the answer is load-bearing in two directions. Key on
 * the wrong entry and every client behind the ALB shares one bucket, so one
 * user can exhaust the login limit for everyone (A2, the defect this guard was
 * written for). Key on an entry the CLIENT controls and any client can pick its
 * own bucket, which is the same as having no limit.
 *
 * The ALB appends the address it actually saw to X-Forwarded-For, so the LAST
 * entry is the real client and every earlier one is whatever the client chose
 * to send. That is the whole argument, and it is what these tests pin.
 */
describe('ThrottlerBehindProxyGuard.getTracker', () => {
  /**
   * `getTracker` is `protected`, which is correct - Nest calls it, nobody else
   * should. A subclass is how a test reaches it without widening the real
   * class's surface.
   */
  class Probe extends ThrottlerBehindProxyGuard {
    public track(req: Record<string, unknown>): Promise<string> {
      return this.getTracker(req);
    }
  }

  let guard: Probe;

  beforeEach(() => {
    const options = { throttlers: [{ ttl: 60_000, limit: 100 }] } as ThrottlerModuleOptions;
    const storage = { increment: jest.fn() } as unknown as ThrottlerStorage;
    guard = new Probe(options, storage, new Reflector());
  });

  const request = (headers: Record<string, string | string[]>, ip?: string) =>
    ({ headers, ...(ip === undefined ? {} : { ip }) }) as unknown as Record<string, unknown>;

  it('takes the LAST entry of the chain', async () => {
    const tracker = await guard.track(
      request({ 'x-forwarded-for': '203.0.113.9, 198.51.100.7, 10.0.0.5' }),
    );

    expect(tracker).toBe('10.0.0.5');
  });

  /**
   * The assertion above would also pass a guard that took the leftmost entry of
   * a one-element chain, so the distinction gets its own test - and this is the
   * one that says why the offset matters. An attacker sends
   * `X-Forwarded-For: <anything>`; the ALB appends the address it saw. Reading
   * the left end reads the attacker's own string, so each forged value is a
   * fresh bucket and the limit is decorative.
   */
  it('ignores an address the client put at the front of the chain', async () => {
    const tracker = await guard.track(
      request({ 'x-forwarded-for': 'a-value-the-client-chose, 10.0.0.5' }),
    );

    expect(tracker).toBe('10.0.0.5');
  });

  it('is not fooled into a new bucket when the forged prefix changes', async () => {
    const first = await guard.track(request({ 'x-forwarded-for': 'forged-one, 10.0.0.5' }));
    const second = await guard.track(request({ 'x-forwarded-for': 'forged-two, 10.0.0.5' }));

    expect(first).toBe(second);
  });

  it('joins the array form and still takes the last entry', async () => {
    const tracker = await guard.track(
      request({ 'x-forwarded-for': ['203.0.113.9', '198.51.100.7, 10.0.0.5'] }),
    );

    expect(tracker).toBe('10.0.0.5');
  });

  it('trims the whitespace the header arrives with', async () => {
    const tracker = await guard.track(request({ 'x-forwarded-for': '203.0.113.9,   10.0.0.5   ' }));

    expect(tracker).toBe('10.0.0.5');
  });

  it('handles a single-entry chain', async () => {
    const tracker = await guard.track(request({ 'x-forwarded-for': '10.0.0.5' }));

    expect(tracker).toBe('10.0.0.5');
  });

  it('skips empty segments rather than keying on an empty string', async () => {
    const tracker = await guard.track(request({ 'x-forwarded-for': '10.0.0.5, ,' }));

    expect(tracker).toBe('10.0.0.5');
  });

  /**
   * The fallbacks. A request that reaches the API without the header is not
   * exempt from the limit - it falls back to the socket address, and then to a
   * single shared bucket named `unknown`. Sharing one bucket is the safe
   * direction: it throttles more, never less.
   */
  it('falls back to req.ip when the header is absent', async () => {
    const tracker = await guard.track(request({}, '198.51.100.20'));

    expect(tracker).toBe('198.51.100.20');
  });

  it('falls back to req.ip when the header is present but empty', async () => {
    const tracker = await guard.track(request({ 'x-forwarded-for': '' }, '198.51.100.20'));

    expect(tracker).toBe('198.51.100.20');
  });

  it('falls back to req.ip when the header is only whitespace', async () => {
    const tracker = await guard.track(request({ 'x-forwarded-for': '   ' }, '198.51.100.20'));

    expect(tracker).toBe('198.51.100.20');
  });

  it("answers 'unknown' when there is neither a chain nor an ip", async () => {
    const tracker = await guard.track(request({}));

    expect(tracker).toBe('unknown');
  });
});
