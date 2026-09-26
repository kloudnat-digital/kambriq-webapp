/**
 * Mock implementation of `next-intl` for Jest tests.
 * Maintains actual translation catalogs (en/fr) to ensure realistic test coverage
 * while bypassing ESM-related transpilation issues in Jest.
 * Missing keys will throw an error to prevent silent translation failures.
 *
 * @example
 * jest.mock('next-intl', () => require('@/test-utils/next-intl-mock'));
 * import { setTestLocale } from '@/test-utils/next-intl-mock';
 */
import { Fragment, type ReactNode } from 'react';
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

/**
 * Core translation resolver decoupled from React context.
 * Enables both `useTranslations` (client hooks) and `getTranslations` (async server API)
 * to share resolution logic without violating React hook constraints.
 */
const makeTranslator = (namespace?: string) => {
  const prefix = namespace ? `${namespace}.` : '';
  const translate = (key: string, args?: Record<string, string | number>): string => {
    const value = resolve(`${prefix}${key}`);
    if (typeof value !== 'string') {
      // Fails fast to prevent silent translation omissions from masking rendering regressions.
      throw new Error(
        `Missing ${locale} translation for "${prefix}${key}". The component would have ` +
          `rendered the key itself to a user.`,
      );
    }
    return interpolate(value, args);
  };
  /**
   * next-intl's `t.rich`: `<tag>chunks</tag>` in a message is rendered by the
   * function passed under that name. A message without tags stays a string.
   */
  translate.rich = (
    key: string,
    values?: Record<string, string | number | ((chunks: ReactNode) => ReactNode)>,
  ): ReactNode => {
    const plain = Object.fromEntries(
      Object.entries(values ?? {}).filter(([, v]) => typeof v !== 'function'),
    ) as Record<string, string | number>;
    const text = translate(key, plain);
    const parts: ReactNode[] = [];
    const tag = /<(\w+)>(.*?)<\/\1>/g;
    let last = 0;
    for (let m = tag.exec(text); m; m = tag.exec(text)) {
      const render = values?.[m[1]];
      parts.push(text.slice(last, m.index), typeof render === 'function' ? render(m[2]) : m[2]);
      last = tag.lastIndex;
    }
    if (last === 0) return text;
    parts.push(text.slice(last));
    return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
  };
  /** Whether a message exists - next-intl's `t.has`, over the real catalogue. */
  translate.has = (key: string): boolean => typeof resolve(`${prefix}${key}`) === 'string';
  // The raw message - an array or an object - and, like `translate`, loud on a miss.
  translate.raw = (key: string): unknown => {
    const value = resolve(`${prefix}${key}`);
    if (value === undefined) throw new Error(`Missing ${locale} message for "${prefix}${key}".`);
    return value;
  };
  return translate;
};

const makeFormatter = () => ({
  dateTime: (value: Date) => value.toISOString(),
  number: (value: number) => String(value),
});

export const useTranslations = (namespace?: string) => makeTranslator(namespace);

/**
 * Mock implementation of `getTranslations` from `next-intl/server`.
 * Provides identical behavior to the hook variant, but is correctly marked async.
 *
 * @example
 * jest.mock('next-intl/server', () => require('@/test-utils/next-intl-mock'));
 */
export const getTranslations = async (namespace?: string) => makeTranslator(namespace);

export const getLocale = async () => locale;
export const getMessages = async () => CATALOGUES[locale];
export const getFormatter = async () => makeFormatter();

export const useLocale = () => locale;
export const useMessages = () => CATALOGUES[locale];
export const useFormatter = () => makeFormatter();
export const NextIntlClientProvider = ({ children }: { children: ReactNode }) => children;
