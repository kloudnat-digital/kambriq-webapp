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

export const uniqueEmail = (prefix: string) =>
  `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@maildrop.cc`;
