import { call, clock, THROTTLE_MAX_ATTEMPTS, THROTTLE_WAIT_MS } from '../journeys/support';

/**
 * A36 - the journey client waits for the rate limiter instead of failing at it.
 *
 * This is a UNIT test, and it is the only test in this project that is. It opens
 * no socket: `fetch` is replaced, and so is the clock, because the property
 * under test is that the client waits the throttle window - and a test that
 * waited sixty real seconds to prove it is a test nobody would keep running.
 *
 * It lives in `src/unit/` and runs under `jest.unit.config.cts`, which loads no
 * `globalSetup`. That separation is the point: `jest.config.cts` - the journeys
 * - points at a DEPLOYED environment, and this file must never be able to
 * reach one. The `test` target added in `project.json` is what makes `Quality`
 * run this on every pull request. Without it the only job that would execute
 * this file is `Delivery journeys (dev)` - the very job it exists to repair,
 * which runs after the merge and never on a pull request.
 */
describe('call() and the throttle window', () => {
  const originalFetch = global.fetch;
  let slept: number[];
  let warned: string[];

  /** Queues responses in order; each call to `fetch` shifts one off. */
  const respondWith = (...statuses: number[]) => {
    const queue = [...statuses];
    const fetchMock = jest.fn(async () => {
      const status = queue.shift();
      if (status === undefined) throw new Error('fetch called more times than the test queued');
      return {
        status,
        text: async () => JSON.stringify({ success: status < 400, data: { status } }),
      };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  /** Always answers 429, however many times it is asked. */
  const alwaysThrottled = () => {
    const fetchMock = jest.fn(async () => ({
      status: 429,
      text: async () => '{"statusCode":429,"message":"ThrottlerException: Too Many Requests"}',
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  };

  beforeEach(() => {
    slept = [];
    warned = [];
    jest.spyOn(clock, 'sleep').mockImplementation(async (ms: number) => {
      slept.push(ms);
    });
    jest.spyOn(console, 'warn').mockImplementation((line: string) => {
      warned.push(line);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('returns the 200 when a 429 is followed by one', async () => {
    const fetchMock = respondWith(429, 200);

    const res = await call('POST', '/auth/login', { body: { email: 'a@b.cc' } });

    expect(res.status).toBe(200);
    expect(res.json<{ data: { status: number } }>().data.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /**
   * The other half of the test above, and the half that can fail on its own.
   *
   * "It returned 200" is also true of a client that ignored the 429 and got
   * lucky on a second immediate attempt. What distinguishes waiting from
   * retrying is the wait, so it is asserted as a separate expectation - Jest
   * stops a test at its first failing `expect`, so a tail bundled onto the
   * assertion above would not be observed failing by itself.
   */
  it('waits before that retry, for the whole window', async () => {
    respondWith(429, 200);

    await call('POST', '/auth/login', { body: { email: 'a@b.cc' } });

    expect(slept).toEqual([THROTTLE_WAIT_MS]);
  });

  it('derives the wait from the real window rather than a round number', () => {
    // THROTTLE_TTL in libs/common/src/config/env.validation.ts:26.
    expect(THROTTLE_WAIT_MS).toBe(60_000);
  });

  it('does not wait at all when the first answer is not a 429', async () => {
    const fetchMock = respondWith(200);

    const res = await call('GET', '/health');

    expect(res.status).toBe(200);
    expect(slept).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /**
   * A retry loop that also swallowed 500s would turn a broken API into a slow
   * one. Only 429 is the rate limiter's request to wait; everything else is an
   * answer the journey is entitled to see immediately.
   */
  it('returns a 500 straight away instead of retrying it', async () => {
    const fetchMock = respondWith(500);

    const res = await call('GET', '/kamnet/leads');

    expect(res.status).toBe(500);
    expect(slept).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('is bounded: it stops after THROTTLE_MAX_ATTEMPTS and throws', async () => {
    const fetchMock = alwaysThrottled();

    await expect(call('POST', '/auth/login', { body: {} })).rejects.toThrow(/rate limited \(429\)/);

    expect(fetchMock).toHaveBeenCalledTimes(THROTTLE_MAX_ATTEMPTS);
    expect(slept).toHaveLength(THROTTLE_MAX_ATTEMPTS - 1);
  });

  /**
   * The message is pinned verbatim, not loosely.
   *
   * A real throttle problem - a limit set too low, a client hammering the API -
   * must still arrive as the sentence this suite has always printed, so that
   * waiting never quietly absorbs it. If the wording is ever softened, this
   * fails.
   */
  it('still says what it said before the retry existed', async () => {
    alwaysThrottled();

    await expect(call('POST', '/auth/login', { body: {} })).rejects.toThrow(
      'POST /auth/login was rate limited (429). This suite ran too soon after a ' +
        'previous run - wait for the throttle window and retry. Not a product failure.',
    );
  });

  it('names the attempts it made in the message it gives up with', async () => {
    alwaysThrottled();

    await expect(call('POST', '/auth/login', { body: {} })).rejects.toThrow(
      new RegExp(`${THROTTLE_MAX_ATTEMPTS} attempts`),
    );
  });

  /**
   * A slow job must explain itself. Sixty silent seconds reads as a hung
   * runner, which is how somebody cancels a run that was about to pass.
   */
  it('prints one line per wait, naming what it waits for and how long', async () => {
    respondWith(429, 200);

    await call('POST', '/auth/login', { body: {} });

    expect(warned).toHaveLength(1);
    expect(warned[0]).toContain('429');
    expect(warned[0]).toContain('POST /auth/login');
    expect(warned[0]).toContain(String(THROTTLE_WAIT_MS));
  });

  it('prints one line for each of the bounded waits, not just the first', async () => {
    alwaysThrottled();

    await expect(call('POST', '/auth/login', { body: {} })).rejects.toThrow();

    expect(warned).toHaveLength(THROTTLE_MAX_ATTEMPTS - 1);
  });
});
