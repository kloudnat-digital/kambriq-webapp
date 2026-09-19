import { KCA1_PRICE_EUR, KCA1_PRICE_XAF_DISPLAY } from '@kambriq/common/constants/kbs/pricing';
import fr from './messages/fr.json';
import en from './messages/en.json';

/**
 * I39b, revised - what the waiting candidate is told, and what they must not be.
 *
 * ---------------------------------------------------------------------------
 * This file's bans were INVERTED on 19 September, and that is the point
 * ---------------------------------------------------------------------------
 * Yesterday the screen promised an email nothing sends and invoked a 249 EUR
 * payment nothing collects, so this guard banned both. Today Visquis has
 * decided the fee is real and settled OUTSIDE the platform, which makes the
 * screen's replacement line - "Rien ne vous est demande pour l'instant" -
 * false the moment a candidate owes 249 EUR.
 *
 * So the price ban becomes a price REQUIREMENT. The old assertion was an
 * accurate statement about yesterday's product and a wrong one about today's;
 * inverting it is the fix, not deleting it. What does NOT change is the email
 * ban: `updateStatus` still writes the row and logs, and there is still no
 * template on that path.
 *
 * The figures are read from `pricing.ts` rather than typed here. A test that
 * hardcodes `249` passes happily on the day the price changes and the copy does
 * not - which is the drift it exists to catch.
 */
type Messages = { app: { kbs: { awaiting: Record<string, string> } } };

const awaiting = (m: unknown) => (m as Messages).app.kbs.awaiting;

const LOCALES: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ['fr', awaiting(fr)],
  ['en', awaiting(en)],
];

const joined = (copy: Record<string, string>) => Object.values(copy).join(' ');

describe('the KBS awaiting-verification copy', () => {
  /** Without this the bans below would pass against an empty or missing block. */
  it.each(LOCALES)('%s still says something at all', (_locale, copy) => {
    expect(copy.title?.length ?? 0).toBeGreaterThan(0);
    expect(copy.description?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(LOCALES)('%s names who has to act', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).toMatch(/admin|equipe|équipe|team/);
  });

  /** Unchanged, and still true: no code sends an activation email. */
  it.each(LOCALES)('%s does not promise an email nobody sends', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).not.toMatch(/e-?mail|courriel|inbox|boite de reception|spam/);
  });

  /**
   * The inversion. The fee is real, so the amount has to be on the screen - in
   * both currencies, because the euro is what the diaspora recognises and the
   * franc is what actually gets paid.
   */
  it.each(LOCALES)('%s states the fee in both currencies', (_locale, copy) => {
    const text = joined(copy);

    expect(text).toContain(String(KCA1_PRICE_EUR));
    expect(text).toContain(KCA1_PRICE_XAF_DISPLAY);
  });

  /**
   * And says where it is settled. "You owe 249 EUR" with no indication of how
   * leaves somebody hunting for a pay button that does not exist - the platform
   * collects nothing, by decision, until `Payment` can carry a KBS subject.
   */
  it.each(LOCALES)('%s says the fee is arranged off the platform', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).toMatch(/directement|hors de la plateforme|outside the platform|directly with/);
  });

  /**
   * The new ban, and the reason this file was reopened at all.
   *
   * "Nothing is expected of you" was true for one day. A candidate who owes a
   * fee and is told nothing is expected will do nothing, and then wonder why
   * they were never let in.
   */
  it.each(LOCALES)('%s does not claim that nothing is expected', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).not.toMatch(/rien ne vous est demand|nothing is expected|rien n'est attendu/);
  });

  /** Activation still has to be named as the thing that follows. */
  it.each(LOCALES)('%s says activation follows', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).toMatch(/activ/);
  });
});
