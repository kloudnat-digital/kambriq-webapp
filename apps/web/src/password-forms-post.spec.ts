import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A33 - a form that holds a password is submitted by POST, even before the
 * page has hydrated.
 *
 * The sign-in form had no `method`. Before its JavaScript has run, a tap on
 * the button is a native submission, and a native submission with no method is
 * a GET: `/fr/login?email=...&password=...`, measured in WebKit on dev on
 * 26 September. The password lands in the browser history, the address bar and
 * every access log on the way. After hydration the handler prevents the native
 * submission, so `method="post"` changes nothing for a hydrated page.
 */
const SRC = __dirname;

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );

const FORMS_WITH_PASSWORDS = walk(SRC)
  .filter((f) => f.endsWith('.tsx') && !f.endsWith('.spec.tsx'))
  .map((f) => ({ file: relative(SRC, f), src: readFileSync(f, 'utf8') }))
  .filter(({ src }) => /<form\b/.test(src) && /(current|new)-password|type="password"/.test(src));

describe('A33 - a password never travels in a URL', () => {
  it('finds the forms that hold a password', () => {
    expect(FORMS_WITH_PASSWORDS.map((f) => f.file)).toEqual(
      expect.arrayContaining(['app/[locale]/(site)/(auth)/login/page.tsx']),
    );
    expect(FORMS_WITH_PASSWORDS.length).toBeGreaterThanOrEqual(5);
  });

  it('each declares method="post" on every form it renders', () => {
    const missing = FORMS_WITH_PASSWORDS.filter(({ src }) =>
      (src.match(/<form\b[^>]*>/g) ?? []).some((tag) => !/method="post"/.test(tag)),
    ).map((f) => f.file);
    expect(missing).toEqual([]);
  });
});
