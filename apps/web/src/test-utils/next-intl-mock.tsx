/**
 * `next-intl`, replaced for tests - but **not** its messages.
 *
 * ---------------------------------------------------------------------------
 * Why a mock at all
 * ---------------------------------------------------------------------------
 * `next-intl` ships ESM from `node_modules`, and `next/jest` builds its
 * `transformIgnorePatterns` from `transpilePackages` in `next.config.ts`.
 * Custom patterns are only ever **appended**, and Jest ignores a file when any
 * pattern matches, so appending cannot un-ignore `/node_modules/`. The two real
 * options were to add `next-intl` to `transpilePackages` - changing how the
 * production bundle is built, for a test - or to replace the module here.
 *
 * `test-setup.ts` predicted this exact moment about MSW: *"That test will also
 * need the transform sorted, which is the right moment to pay for it."* This is
 * the cheaper half of that bill: the plumbing is replaced, the payload is not.
 *
 * ---------------------------------------------------------------------------
 * What is mocked, and what deliberately is not
 * ---------------------------------------------------------------------------
 * **The catalogues are the real ones.** `fr.json` and `en.json` are plain JSON
 * and import fine, so a test that asserts a visible error message asserts the
 * French string that ships. A mock returning the key would let a component pass
 * its tests while rendering `contact.form.subjectRequired` to a prospect.
 *
 * Missing keys **throw**. A translation function that returns the key on a miss
 * is a mechanism reporting success by saying nothing: the test goes green and
 * the page shows a dotted path.
 *
 * Usage, at the top of a test file:
 *
 *   jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
 *   import { setTestLocale } from '@/test-utils/next-intl-mock';
 */
import type { ReactNode } from 'react';
import en from '@/i18n/messages/en.json';
import fr from '@/i18n/messages/fr.json';

type Messages = Record<string, unknown>;

const CATALOGUES: Record<string, Messages> = { en, fr };

let locale = 'fr';

/** Switches the catalogue every subsequent render reads. */
export const setTestLocale = (next: 'en' | 'fr') => {
  locale = next;
};

const resolve = (path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => {
    if (node === undefined || node === null || typeof node !== 'object') return undefined;
    return (node as Messages)[key];
  }, CATALOGUES[locale]);

const interpolate = (template: string, args?: Record<string, string | number>): string =>
  args
    ? Object.entries(args).reduce(
        (out, [key, value]) => out.replaceAll(`{${key}}`, String(value)),
        template,
      )
    : template;

export const useTranslations = (namespace?: string) => {
  const prefix = namespace ? `${namespace}.` : '';
  const translate = (key: string, args?: Record<string, string | number>): string => {
    const value = resolve(`${prefix}${key}`);
    if (typeof value !== 'string') {
      // Loud on purpose. See the note above.
      throw new Error(
        `Missing ${locale} translation for "${prefix}${key}". The component would have ` +
          `rendered the key itself to a user.`,
      );
    }
    return interpolate(value, args);
  };
  translate.rich = translate;
  return translate;
};

export const useLocale = () => locale;
export const useMessages = () => CATALOGUES[locale];
export const useFormatter = () => ({
  dateTime: (value: Date) => value.toISOString(),
  number: (value: number) => String(value),
});
export const NextIntlClientProvider = ({ children }: { children: ReactNode }) => children;
