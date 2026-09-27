/**
 * Reading what a person receives: the delivered email, from the maildrop.cc
 * inbox the journeys and walks use (TEST_DOMAIN - nothing real lives there).
 */
const MAILDROP = 'https://api.maildrop.cc/graphql';

const maildrop = async (query: string) => {
  const res = await fetch(MAILDROP, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`maildrop unavailable (HTTP ${res.status}) - not a product failure`);
  return res.json() as Promise<{
    data?: { inbox?: Array<{ id: string; subject: string }>; message?: { html: string } };
  }>;
};

/** The button link of the message whose subject matches, read out of the delivered HTML. */
export const emailedLink = async (
  mailbox: string,
  subject: RegExp,
  timeoutMs = 120_000,
): Promise<string> => {
  const deadline = Date.now() + timeoutMs;
  const subjects: string[] = [];
  while (Date.now() < deadline) {
    const list =
      (await maildrop(`query{inbox(mailbox:"${mailbox}"){id subject}}`)).data?.inbox ?? [];
    for (const m of list) {
      subjects.push(m.subject);
      if (!subject.test(m.subject)) continue;
      const html =
        (await maildrop(`query{message(mailbox:"${mailbox}",id:"${m.id}"){html}}`)).data?.message
          ?.html ?? '';
      const href = /<a href="([^"]+)" class="btn"/.exec(html)?.[1];
      if (href) return href.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `no message matching ${subject} in ${mailbox}. Subjects seen: ${subjects.join(' | ') || '(empty)'}`,
  );
};
