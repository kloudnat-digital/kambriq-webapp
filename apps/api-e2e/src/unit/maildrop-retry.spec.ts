import { clock, inbox, MAILDROP_ATTEMPTS, message } from '../journeys/support';

/**
 * The journeys' mailbox reader waits out a short maildrop outage and says so,
 * and never retries a request maildrop refused as malformed. A unit test:
 * `fetch` and the clock are replaced, nothing reaches maildrop.
 */
describe('the maildrop reader and a third-party outage', () => {
  const originalFetch = global.fetch;
  let slept: number[];
  let warned: string[];

  /** Each call to `fetch` takes the next answer: a status, or an Error to throw. */
  const answers = (...queue: Array<number | Error>) => {
    const fetchMock = jest.fn(async () => {
      const next = queue.shift();
      if (next === undefined) throw new Error('fetch called more times than the test queued');
      if (next instanceof Error) throw next;
      return {
        ok: next < 400,
        status: next,
        json: async () => ({
          data: { inbox: [{ id: 'm1', subject: 'Bienvenue' }], message: { html: '<p>x</p>' } },
        }),
      };
    });
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
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('waits out a 5xx and reads the mailbox, saying it retried and why', async () => {
    const fetchMock = answers(520, 200);
    await expect(inbox('box')).resolves.toEqual([{ id: 'm1', subject: 'Bienvenue' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(slept).toEqual([2000]);
    expect(warned).toEqual([
      expect.stringContaining('maildrop answered HTTP 520 (attempt 1 of 4)'),
    ]);
  });

  it('waits out a network failure the same way', async () => {
    answers(new TypeError('fetch failed'), 200);
    await expect(inbox('box')).resolves.toHaveLength(1);
    expect(warned[0]).toContain('network error: fetch failed');
  });

  it('never retries a 4xx: that is our request, and it stays loud', async () => {
    const fetchMock = answers(400);
    await expect(inbox('box')).rejects.toThrow('maildrop refused the request (HTTP 400)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(slept).toEqual([]);
  });

  it('gives up after its attempts, still naming maildrop, with growing waits', async () => {
    const fetchMock = answers(502, 502, 502, 502);
    await expect(inbox('box')).rejects.toThrow(
      `maildrop unavailable (HTTP 502) after ${MAILDROP_ATTEMPTS} attempts - not a product failure`,
    );
    expect(fetchMock).toHaveBeenCalledTimes(MAILDROP_ATTEMPTS);
    expect(slept).toEqual([2000, 4000, 8000]);
  });

  it('retries the message read as well as the inbox', async () => {
    answers(503, 200);
    await expect(message('box', 'm1')).resolves.toBe('<p>x</p>');
    expect(slept).toEqual([2000]);
  });
});
