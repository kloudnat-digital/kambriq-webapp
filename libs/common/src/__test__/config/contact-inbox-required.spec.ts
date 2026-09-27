import { envSchema } from '../../config/env.validation';

/**
 * A54 - the API refuses to start without the address the contact digest and
 * the contact notifications are sent to.
 *
 * It was optional, so a dev task started without it, stored every contact
 * request, and failed the digest once a day at 07:00 where nobody looked. A
 * process that cannot do its job refuses at startup, where a deploy watches.
 */
const BASE = {
  DATABASE_URL_CORE: 'postgresql://x/core',
  DATABASE_URL_KBS: 'postgresql://x/kbs',
  DATABASE_URL_KAMNET: 'postgresql://x/kamnet',
  DATABASE_URL_LANDS: 'postgresql://x/lands',
  JWT_SECRET: 'x'.repeat(32),
};

const issuesFor = (config: Record<string, unknown>) => {
  const result = envSchema.safeParse(config);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('A54 - CONTACT_INBOX_EMAIL is required at startup', () => {
  it('the baseline is otherwise valid', () => {
    expect(issuesFor({ ...BASE, CONTACT_INBOX_EMAIL: 'inbox@example.test' })).toEqual([]);
  });

  it('absent: refused, naming it', () => {
    expect(issuesFor(BASE)).toEqual(['CONTACT_INBOX_EMAIL']);
  });

  it('empty, as an unfilled .env line leaves it: refused, naming it', () => {
    expect(issuesFor({ ...BASE, CONTACT_INBOX_EMAIL: '' })).toEqual(['CONTACT_INBOX_EMAIL']);
  });
});
