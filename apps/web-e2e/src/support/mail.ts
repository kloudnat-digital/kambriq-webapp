/* eslint-disable @nx/enforce-module-boundaries */
/**
 * Reading what a person receives: the delivered email, from the maildrop.cc
 * inbox the journeys and walks use (TEST_DOMAIN - nothing real lives there).
 */
// The journeys' reader is the one client of maildrop's API: it waits out a 5xx
// or a network failure and says so (A69, #265). Shared across the two e2e
// projects rather than copied, so there is one retry to keep right.
export { inbox, message } from '../../../api-e2e/src/journeys/support';
import { inbox, message } from '../../../api-e2e/src/journeys/support';

/** The button link of the message whose subject matches, read out of the delivered HTML. */
export const emailedLink = async (
  mailbox: string,
  subject: RegExp,
  timeoutMs = 120_000,
): Promise<string> => {
  const deadline = Date.now() + timeoutMs;
  const subjects: string[] = [];
  while (Date.now() < deadline) {
    const list = await inbox(mailbox);
    for (const m of list) {
      subjects.push(m.subject);
      if (!subject.test(m.subject)) continue;
      const html = await message(mailbox, m.id);
      const href = /<a href="([^"]+)" class="btn"/.exec(html)?.[1];
      if (href) return href.replace(/&amp;/g, '&');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(
    `no message matching ${subject} in ${mailbox}. Subjects seen: ${subjects.join(' | ') || '(empty)'}`,
  );
};
