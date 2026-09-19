import fr from './messages/fr.json';
import en from './messages/en.json';

/**
 * I39b - what the waiting candidate is told, and what they must not be told.
 *
 * The brief for this said the screen "must SAY what is being waited for and by
 * whom". It already did. The trouble was the other half of what it said:
 *
 *   - **it promised an email.** `updateStatus` writes the row and logs. There
 *     is no `kbsAccessEnabled` template and no send anywhere on that path, so
 *     "vous recevrez un e-mail des que votre acces sera active" was a promise
 *     the platform had no way to keep - and the candidate was told to watch
 *     their inbox, including spam, for a message that was never going to come;
 *   - **it invoked a 249 EUR payment.** Nothing on the platform collects money
 *     for KBS. The figure lives on the public marketing page; the product has
 *     no KBS payment at all, so an administrator "verifying your payment"
 *     describes a step nobody performs.
 *
 * A screen that says nothing leaves somebody guessing. A screen that says
 * something false sends them to wait for a message that will never arrive, and
 * that is worse - the same family as a preference stored with no capability
 * behind it, and as a comment that refuses nothing.
 *
 * So this bans the two false claims and REQUIRES the true one, because a guard
 * that only bans would be satisfied by deleting the text altogether.
 */
type Messages = { app: { kbs: { awaiting: Record<string, string> } } };

const awaiting = (m: unknown) => (m as Messages).app.kbs.awaiting;

const LOCALES: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ['fr', awaiting(fr)],
  ['en', awaiting(en)],
];

describe('the KBS awaiting-verification copy', () => {
  /** Without this the bans below would pass against an empty or missing block. */
  it.each(LOCALES)('%s still says something at all', (_locale, copy) => {
    expect(copy.title?.length ?? 0).toBeGreaterThan(0);
    expect(copy.description?.length ?? 0).toBeGreaterThan(0);
  });

  /**
   * The positive half. The candidate has to learn WHO is acting, or the screen
   * is just a shrug.
   */
  it.each(LOCALES)('%s names who has to act', (_locale, copy) => {
    const text = Object.values(copy).join(' ').toLowerCase();

    // `admin` rather than `administrator`: the English copy says "an admin",
    // which names the actor perfectly well. The first version of this pattern
    // demanded the long form and failed honest copy - the guard is about
    // somebody being named, not about which word names them.
    expect(text).toMatch(/admin|equipe|équipe|team/);
  });

  it.each(LOCALES)('%s does not promise an email nobody sends', (_locale, copy) => {
    const text = Object.values(copy).join(' ').toLowerCase();

    expect(text).not.toMatch(/e-?mail|courriel|inbox|boite de reception|spam/);
  });

  it.each(LOCALES)('%s does not invoke a payment nothing collects', (_locale, copy) => {
    const text = Object.values(copy).join(' ');

    expect(text).not.toMatch(/249/);
    // `\beur\b`, not `eur\b`: **administrateur** ends in "eur" with a word
    // boundary after it, so the looser pattern banned the very word the test
    // above requires. A ban that fires on correct copy is worse than no ban -
    // it teaches whoever meets it to weaken the guard.
    expect(text.toLowerCase()).not.toMatch(/paiement|payment|€|\beur\b/);
  });
});
