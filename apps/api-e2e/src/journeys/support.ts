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

export const call = async (
  method: string,
  path: string,
  opts: { body?: unknown; token?: string } = {},
): Promise<Res> => {
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
   * 429 is never a legitimate result here, so it is named rather than asserted
   * against.
   *
   * The API throttles at `THROTTLE_LIMIT` requests per `THROTTLE_TTL`. Running
   * this suite back to back exhausts that, and the failure then surfaces as
   * "expected 200, received 429" on a login — which reads as a broken auth path
   * and is not. In CI the suite runs once per deploy and never sees it; a human
   * re-running it three times in a minute will, and should be told what happened
   * instead of debugging the product.
   */
  if (res.status === 429) {
    throw new Error(
      `${method} ${path} was rate limited (429). This suite ran too soon after a ` +
        `previous run - wait for the throttle window and retry. Not a product failure.`,
    );
  }

  return {
    status: res.status,
    body,
    json: <T>() => JSON.parse(body) as T,
  };
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
