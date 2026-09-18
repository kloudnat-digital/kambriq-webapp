/**
 * Shared helpers for the delivery journeys.
 *
 * These run against a **deployed** environment, not a local process. That is the
 * point: every defect this week that mattered was invisible to unit tests and
 * visible on the first real request — a null SES client, an unsigned S3 URL, a
 * `?token=[object Promise]`, a quiz scored out of the wrong denominator. Proof by
 * execution rather than by inspection.
 */
export const API =
  process.env['KAMBRIQ_API_URL']?.replace(/\/$/, '') ?? 'https://dev.kambriq.com/api/v1';

export type Res = { status: number; body: string; json: <T>() => T };

/**
 * The wait this client owes the rate limiter, and where the number comes from.
 *
 * The API throttles at `THROTTLE_LIMIT` 100 requests per `THROTTLE_TTL` 60000
 * ms, both declared at `libs/common/src/config/env.validation.ts:26-27`. Those
 * are the values that actually run: `apps/api/src/app/app.module.ts:34` wires
 * `ConfigModule.forRoot({ validate: validateEnv })`, so `ConfigService` serves
 * the validated default and the contradictory `6000` written as a fallback at
 * `apps/api/src/app/app.module.ts:84` is never reached. Nothing under `docker/`
 * or `.github/` sets either variable, so the schema default is the deployed
 * value - this constant tracks that declaration and nothing else.
 *
 * The wait is the WHOLE window rather than a fraction of it. The throttler's
 * record expires one TTL after the request that opened it, and a client holding
 * a 429 cannot know when that was, so one full window is the only wait
 * guaranteed to meet a drained bucket. Anything shorter is a guess that works
 * until the day it does not.
 */
export const THROTTLE_WAIT_MS = 60_000;

/** Requests the API allows inside one `THROTTLE_WAIT_MS` window. Same source. */
const THROTTLE_LIMIT = 100;

/** Total attempts per request, so at most two waits and never an open loop. */
export const THROTTLE_MAX_ATTEMPTS = 3;

/**
 * The clock, as a replaceable collaborator.
 *
 * The journeys use the real one. `src/unit/support.call.spec.ts` replaces it,
 * because the property under test is that the client waits the window - and a
 * test that waited sixty real seconds to prove it is a test nobody would keep
 * running.
 */
export const clock = {
  sleep: (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms)),
};

export const call = async (
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {},
): Promise<Res> => {
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
    });
    const body = await res.text();

    /**
     * A 429 is not a result. It is the rate limiter asking this client to wait,
     * so this client waits - bounded, and loud about it.
     *
     * A36. The comment that stood here said "in CI the suite runs once per
     * deploy and never sees it", and run 35306506751 saw it twice. What is
     * true: the `journeys` target runs `runInBand`, so both suites execute in
     * ONE process from ONE runner address, and
     * `ThrottlerBehindProxyGuard.getTracker` keys on the last X-Forwarded-For
     * entry - so the two suites legitimately share ONE bucket, and the gap
     * between them decides the outcome. Measured across three runs with
     * identical accounts: a gap of 9.33 s between the end of `journeys.spec.ts`
     * and the start of `kamnet-network-isolation.spec.ts` PASSED on 1cbde1a;
     * 0.36 s FAILED on 70a5e07; that job re-run alone, at 0.35 s, FAILED
     * identically. `journeys.spec.ts` issues 53 requests including 5 logins
     * inside one minute and fills almost the whole window, so whichever suite
     * follows it finds the bucket full. A prose guarantee the system does not
     * keep is the same family as a guard that names a danger without refusing
     * it.
     *
     * Two alternatives were refused rather than overlooked. A fixed pause
     * between suites works today and breaks when the fourth suite arrives.
     * Raising `THROTTLE_LIMIT` on dev removes a real protection to make a test
     * pass. Waiting is what a client owes a rate limiter.
     *
     * After `THROTTLE_MAX_ATTEMPTS` it gives up with the sentence this suite
     * has always printed, so a genuine throttle problem - a limit set too low,
     * a client hammering the API - is never absorbed by the waiting.
     */
    if (res.status === 429) {
      if (attempt >= THROTTLE_MAX_ATTEMPTS) {
        throw new Error(
          `${method} ${path} was rate limited (429). This suite ran too soon after a ` +
            `previous run - wait for the throttle window and retry. Not a product failure. ` +
            `Gave up after ${THROTTLE_MAX_ATTEMPTS} attempts and ` +
            `${THROTTLE_MAX_ATTEMPTS - 1} waits of ${THROTTLE_WAIT_MS} ms.`,
        );
      }

      // One line per wait. Sixty silent seconds reads as a hung runner, and a
      // hung runner is what somebody cancels.
      console.warn(
        `[journeys] ${method} ${path} answered 429. The API allows ${THROTTLE_LIMIT} ` +
          `requests per ${THROTTLE_WAIT_MS} ms and this runner's bucket is full. Waiting ` +
          `${THROTTLE_WAIT_MS} ms for the window to roll, then retrying - attempt ` +
          `${attempt + 1} of ${THROTTLE_MAX_ATTEMPTS}.`,
      );
      await clock.sleep(THROTTLE_WAIT_MS);
      continue;
    }

    return {
      status: res.status,
      body,
      json: <T>() => JSON.parse(body) as T,
    };
  }
};

export const login = async (email: string, password = 'Test1234!'): Promise<string> => {
  const res = await call('POST', '/auth/login', { body: { email, password } });
  if (res.status !== 200) {
    throw new Error(`login failed for ${email}: ${res.status} ${res.body.slice(0, 200)}`);
  }
  return res.json<{ data: { tokens: { accessToken: string } } }>().data.tokens.accessToken;
};

/**
 * Reads a mailbox on maildrop.cc.
 *
 * A third-party dependency in a test is a liability, and it is carried here on
 * purpose: A3 shipped `?token=[object Promise]` in every verification link
 * precisely because nothing ever opened the email. The failure message says when
 * the mailbox is the problem, so a maildrop outage does not read as a product
 * defect.
 */
export const inbox = async (mailbox: string): Promise<Array<{ id: string; subject: string }>> => {
  const res = await fetch('https://api.maildrop.cc/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `query{inbox(mailbox:"${mailbox}"){id subject}}` }),
  });
  if (!res.ok) throw new Error(`maildrop unavailable (HTTP ${res.status}) - not a product failure`);
  const parsed = (await res.json()) as {
    data?: { inbox?: Array<{ id: string; subject: string }> };
  };
  return parsed.data?.inbox ?? [];
};

export const message = async (mailbox: string, id: string): Promise<string> => {
  const res = await fetch('https://api.maildrop.cc/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `query{message(mailbox:"${mailbox}",id:"${id}"){html}}` }),
  });
  const parsed = (await res.json()) as { data?: { message?: { html?: string } } };
  return parsed.data?.message?.html ?? '';
};

/**
 * Finds a token in ANY message in the mailbox, not the first one.
 *
 * Reading `inbox[0]` and concluding "there is no link" is how a non-defect nearly
 * got filed this week: the reservation flow sends two emails, and the invite was
 * the second. Reading the first element of a list is not reading the list.
 */
export const findTokenInMailbox = async (
  mailbox: string,
  pattern: RegExp,
  timeoutMs = 120_000,
): Promise<string> => {
  const deadline = Date.now() + timeoutMs;
  const seen: string[] = [];
  while (Date.now() < deadline) {
    const messages = await inbox(mailbox);
    for (const m of messages) {
      seen.push(m.subject);
      const found = pattern.exec(await message(mailbox, m.id));
      if (found?.[1]) return found[1];
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `no token matching ${pattern} in mailbox ${mailbox} after ${timeoutMs}ms. ` +
      `Subjects seen: ${seen.length ? seen.join(' | ') : '(mailbox empty)'}`,
  );
};

/** The only domain any journey may address. Nothing real lives here. */
export const TEST_DOMAIN = 'maildrop.cc';

/**
 * Every address this process has minted. Membership, not shape, is the test.
 *
 * A pattern check asks "does this look disposable". That is a question a real
 * address can pass — and one a hand-edited literal can pass while belonging to
 * somebody. This asks "did **this run's generator** produce it", which no
 * address typed by a person can answer yes to.
 *
 * The distinction is not academic. A journey was pointed at a real
 * administrator's address, its `@maildrop.cc` assertion failed exactly as
 * designed, the run continued anyway, and its cleanup revoked that person's
 * role. Under `assertMinted` the address is refused because it was never
 * minted, and no pattern needs to be right about it.
 */
const MINTED = new Set<string>();

export const uniqueEmail = (prefix: string): string => {
  const address = `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@${TEST_DOMAIN}`;
  MINTED.add(address);
  return address;
};

/** Throws unless `address` came out of `uniqueEmail` in this process. */
export const assertMinted = (address: string): void => {
  if (!MINTED.has(address)) {
    throw new Error(
      `refusing to act on ${address}: it was not generated by uniqueEmail() in this run. ` +
        `Journeys may only address identities they minted themselves. dev holds real ` +
        `people's accounts; a journey that can name one can destroy one. Nothing has been sent.`,
    );
  }
};

/**
 * Throws unless the row at `userId` is the one this run created at `address`.
 *
 * For cleanup, which is where the danger actually lives. A `DELETE` in an
 * `afterAll` looks like tidiness and is a write like any other; the one that
 * stripped a real administrator was a cleanup acting on an id captured earlier
 * in the same run, from a reservation that had silently returned an **existing**
 * user rather than creating a new one.
 *
 * Checking the id against a variable is not enough — that variable is exactly
 * what was wrong. The row is read back and its email compared to the minted
 * address, so the claim "this row is mine" is answered by the database.
 */
export const assertOwnedByThisRun = async (
  userId: string | undefined,
  address: string,
  token: string,
): Promise<void> => {
  assertMinted(address);
  if (!userId) {
    throw new Error(
      'refusing to clean up: no user id was captured, so there is nothing proven to own',
    );
  }
  const res = await call('GET', `/users/${userId}`, { token });
  if (res.status !== 200) {
    throw new Error(`refusing to clean up ${userId}: could not read it back (HTTP ${res.status})`);
  }
  const found = res.json<{ data: { email: string } }>().data.email;
  if (found !== address) {
    throw new Error(
      `refusing to clean up ${userId}: it belongs to ${found}, not to this run's ${address}. ` +
        `A cleanup acting on somebody else's row is how a real administrator lost their role.`,
    );
  }
};
