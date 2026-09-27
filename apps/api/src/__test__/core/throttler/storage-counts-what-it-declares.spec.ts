import { ThrottlerStorageService } from '@nestjs/throttler';

/**
 * A56 - what the API's rate limiter actually counts.
 *
 * Every limit is declared as "N calls per caller per route within TTL". These
 * tests hold the storage the API uses to that declaration: a caller's hit is
 * forgotten TTL after it was made, whatever any other caller or route does.
 */
describe('A56 - a caller is counted over its own window, whatever others do', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const TTL = 60_000;
  const LIMIT = 10;

  it('forgets a hit TTL after it was made', async () => {
    const storage = new ThrottlerStorageService();
    for (let i = 0; i < 8; i++) await storage.increment('suite', TTL, LIMIT, TTL, 'default');
    jest.advanceTimersByTime(TTL + 1);
    const next = await storage.increment('suite', TTL, LIMIT, TTL, 'default');
    expect(next.totalHits).toBe(1);
  });

  it("keeps forgetting a caller's hits when another caller's block ends", async () => {
    const storage = new ThrottlerStorageService();

    // t = 0: another caller, on another route, is blocked.
    for (let i = 0; i < LIMIT + 1; i++) {
      await storage.increment('other-caller', TTL, LIMIT, TTL, 'default');
    }

    // t = 50 s: this caller spends eight of its ten.
    jest.advanceTimersByTime(50_000);
    for (let i = 0; i < 8; i++) await storage.increment('suite', TTL, LIMIT, TTL, 'default');

    // t = 61 s: the other caller's block has ended; it calls again and is reset.
    jest.advanceTimersByTime(11_000);
    await storage.increment('other-caller', TTL, LIMIT, TTL, 'default');

    // t = 111 s: this caller's eight hits are more than TTL old.
    jest.advanceTimersByTime(50_000);
    const next = await storage.increment('suite', TTL, LIMIT, TTL, 'default');
    expect(next.totalHits).toBe(1);
    expect(next.isBlocked).toBe(false);
  });
});
