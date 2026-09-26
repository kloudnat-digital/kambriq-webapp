import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import fr from './messages/fr.json';
import en from './messages/en.json';

/**
 * A53 follow-up - a namespace nothing reads is copy nobody reviews. When A53
 * deleted the land search and compare screens, `landSearch` and `landsCompare`
 * stayed behind: 148 lines per language that any sweep of public copy still
 * read and a translator would still maintain.
 *
 * A namespace counts as read when some non-spec source file names it as a
 * string: `useTranslations('ns')`, `getTranslations('ns.sub')`, a `namespace`
 * prop, or a root translator's `t('ns.key')`.
 */
const WEB_SRC = join(__dirname, '..');

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const SOURCE = walk(WEB_SRC)
  .filter((f) => /\.tsx?$/.test(f) && !/\.spec\.tsx?$/.test(f))
  .map((f) => readFileSync(f, 'utf8'))
  .join('\n');

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isRead = (ns: string) => new RegExp(`['"\`]${escape(ns)}[.'"\`]`).test(SOURCE);

describe('A53 follow-up - every translation namespace is read by something', () => {
  it.each([
    ['fr', fr],
    ['en', en],
  ] as const)('%s', (_locale, messages) => {
    expect(Object.keys(messages).filter((ns) => !isRead(ns))).toEqual([]);
  });
});
