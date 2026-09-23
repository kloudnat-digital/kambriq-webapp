import { KCA1_PRICE_EUR, KCA1_PRICE_XAF_DISPLAY } from '@kambriq/common/constants/kbs/pricing';
import fr from './messages/fr.json';
import en from './messages/en.json';

/**
 * Tests for the KBS awaiting-verification copy.
 * Validates that the UI accurately reflects current business rules:
 * - A 249 EUR / 163,333 XAF fee must be paid off-platform.
 * - No automated activation email is promised.
 * - Explicitly states that further action (activation) is pending.
 */
type Messages = { app: { kbs: { awaiting: Record<string, string> } } };

const awaiting = (m: unknown) => (m as Messages).app.kbs.awaiting;

const LOCALES: ReadonlyArray<readonly [string, Record<string, string>]> = [
  ['fr', awaiting(fr)],
  ['en', awaiting(en)],
];

const joined = (copy: Record<string, string>) => Object.values(copy).join(' ');

describe('the KBS awaiting-verification copy', () => {
  // Ensure localization blocks are not empty.
  it.each(LOCALES)('%s still says something at all', (_locale, copy) => {
    expect(copy.title?.length ?? 0).toBeGreaterThan(0);
    expect(copy.description?.length ?? 0).toBeGreaterThan(0);
  });

  it.each(LOCALES)('%s names who has to act', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).toMatch(/admin|equipe|équipe|team/);
  });

  // Ensure no activation email is promised.
  it.each(LOCALES)('%s does not promise an email nobody sends', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).not.toMatch(/e-?mail|courriel|inbox|boite de reception|spam/);
  });

  // Verify the required fee is displayed in both EUR and XAF.
  it.each(LOCALES)('%s states the fee in both currencies', (_locale, copy) => {
    const text = joined(copy);

    expect(text).toContain(String(KCA1_PRICE_EUR));
    expect(text).toContain(KCA1_PRICE_XAF_DISPLAY);
  });

  // Verify the copy indicates payment must be handled off-platform.
  it.each(LOCALES)('%s says the fee is arranged off the platform', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).toMatch(/directement|hors de la plateforme|outside the platform|directly with/);
  });

  // Ensure the copy does not state that no further action is required.
  it.each(LOCALES)('%s does not claim that nothing is expected', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).not.toMatch(/rien ne vous est demand|nothing is expected|rien n'est attendu/);
  });

  // Ensure 'activation' is mentioned as the next step.
  it.each(LOCALES)('%s says activation follows', (_locale, copy) => {
    const text = joined(copy).toLowerCase();

    expect(text).toMatch(/activ/);
  });
});
