import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * I45 - every web URL the API builds for an email leads to a page that exists.
 *
 * The invitation every new client receives pointed at `/auth/set-password`,
 * and the email-change confirmation at `/auth/confirm-email-change`; neither
 * page existed, so both answered 404 on dev. Nothing noticed, by construction:
 * the journeys read the token out of the mailbox and call the API, never the
 * page a person reaches by clicking.
 *
 * **Inverted:** every URL built on `FRONTEND_URL` anywhere in the API or
 * `libs/common` is checked, found by reading the source - there is no list of
 * URLs to forget one from. A URL that must not be checked needs an entry in
 * `EXEMPT`, with its reason.
 */
const ROOT = join(__dirname, '../../../../..');
const SOURCES = ['apps/api/src', 'libs/common/src'];
const APP = join(ROOT, 'apps/web/src/app/[locale]');

const EXEMPT: Readonly<Record<string, string>> = {};

const walk = (dir: string, keep: (name: string) => boolean): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      return ['node_modules', '__test__'].includes(e.name) || p.endsWith(join('src', 'prisma'))
        ? []
        : walk(p, keep);
    }
    return keep(e.name) ? [p] : [];
  });

/** `${...FRONTEND_URL...}/path/${id}?token=...` -> `/path/:param`, with where it was found. */
export const emailedUrls = (): Array<{ path: string; at: string }> => {
  const BUILT = /\$\{[^`]*?(?:frontendUrl|FRONTEND_URL)[^`]*?\}(\/[^`?\s#]*)/g;
  return SOURCES.flatMap((root) =>
    walk(join(ROOT, root), (n) => n.endsWith('.ts') && !n.endsWith('.spec.ts')).flatMap((file) => {
      const src = readFileSync(file, 'utf8');
      return [...src.matchAll(BUILT)].map((m) => ({
        path: m[1].replace(/\$\{[^}]*\}/g, ':param'),
        at: `${relative(ROOT, file)}:${src.slice(0, m.index).split('\n').length}`,
      }));
    }),
  );
};

/** The web's pages, as patterns: route groups dropped, `[id]` any one segment. */
const pagePatterns = (): RegExp[] =>
  walk(APP, (n) => n === 'page.tsx').map((file) => {
    const segments = relative(APP, file)
      .split(sep)
      .slice(0, -1)
      .filter((s) => !(s.startsWith('(') && s.endsWith(')')));
    const body = segments
      .map((s) =>
        s.startsWith('[...') ? '.+' : s.startsWith('[') ? '[^/]+' : s.replace(/[.*+?^$|]/g, '\\$&'),
      )
      .join('/');
    return new RegExp(`^/${body}$`);
  });

const resolves = (path: string, pages: RegExp[]) =>
  pages.some((p) => !p.source.includes('.+') && p.test(path.replace(/:param/g, 'x')));

describe('I45 - an emailed URL leads to a page', () => {
  it('every URL the API emails resolves to a web page', () => {
    const pages = pagePatterns();
    const broken = emailedUrls()
      .filter(({ path }) => !(path in EXEMPT))
      .filter(({ path }) => !resolves(path, pages))
      .map(({ path, at }) => `${path} (${at})`);
    expect(broken).toEqual([]);
  });

  it('actually finds the emailed URLs, and reads the pages', () => {
    const paths = emailedUrls().map((u) => u.path);
    expect(paths).toEqual(expect.arrayContaining(['/verify-email', '/reset-password']));
    expect(paths.length).toBeGreaterThanOrEqual(6);
    expect(resolves('/reset-password', pagePatterns())).toBe(true);
    expect(resolves('/nowhere-at-all', pagePatterns())).toBe(false);
  });

  it('every exemption names a URL the API still emails', () => {
    const paths = new Set(emailedUrls().map((u) => u.path));
    expect(Object.keys(EXEMPT).filter((p) => !paths.has(p))).toEqual([]);
  });
});
