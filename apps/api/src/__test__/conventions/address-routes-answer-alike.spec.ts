import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * C37, C38 - an unauthenticated route that takes an address from a stranger
 * answers the same whatever the account's state, in the request's language.
 *
 * Found one door at a time: sign-in (C37), then resend-verification, then
 * forgot-password, reactivate and the newsletter (C38). So the family is listed
 * here, and a new public route whose body carries an `email` fails this test
 * until it is placed in it: equalised - and the spec proving it named -
 * declared with the reason it is not, or marked as reading no account.
 *
 * The proof of each equalised route is behavioural and lives beside the
 * service: every account state answers exactly as an unknown address, under a
 * translation mock that shows the language.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const API = join(ROOT, 'apps', 'api', 'src');

type Placement = { equalised: string } | { declared: string } | { noAccountRead: string };

export const FAMILY: Record<string, Placement> = {
  'POST /auth/login': { equalised: 'apps/api/src/__test__/core/auth/auth.service.spec.ts (C37)' },
  'POST /auth/resend-verification': {
    equalised: 'apps/api/src/__test__/core/auth/auth.service.spec.ts (C37)',
  },
  'POST /auth/forgot-password': {
    equalised: 'apps/api/src/__test__/core/auth/auth.service.spec.ts (C38)',
  },
  'POST /auth/reactivate': {
    equalised: 'apps/api/src/__test__/core/auth/auth.service.spec.ts (C38)',
  },
  'POST /newsletter/subscribe': {
    equalised: 'apps/api/src/__test__/newsletter/newsletter.service.spec.ts (C38)',
  },
  'POST /auth': {
    declared:
      "registration answers 409 for an address that has an account. An equal answer means telling an existing holder by email (new copy) instead of on the screen, and a response that no longer carries the new user and its tokens - Visquis's",
  },
  'POST /contact/requests': { noAccountRead: 'stores the request; no account is read' },
};

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === '__test__' ? [] : walk(join(dir, e.name))) : [join(dir, e.name)],
  );

const sources = walk(API).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
const text = new Map(sources.map((f) => [f, readFileSync(f, 'utf8')]));

/** Whether the body DTO `name` is built on a schema declaring an `email` field. */
const dtoCarriesEmail = (name: string): boolean => {
  for (const src of text.values()) {
    const cls = src.match(new RegExp(`class ${name} extends createZodDto\\((\\w+)\\)`));
    if (!cls) continue;
    const start = src.search(new RegExp(`const ${cls[1]}\\s*=`));
    if (start < 0) return false;
    const block = src.slice(start, src.indexOf('\n});', start) + 4);
    return /^\s+email:/m.test(block);
  }
  return false;
};

/** Every @Public() route whose body carries an address: "METHOD /prefix/path". */
export const publicAddressRoutes = (): string[] =>
  [...text.entries()]
    .filter(([f]) => f.endsWith('.controller.ts'))
    .flatMap(([, src]) => {
      const prefix = src.match(/@Controller\('([^']*)'\)/)?.[1] ?? '';
      const routes: string[] = [];
      const handler =
        /@Public\(\)[\s\S]*?@(Post|Put|Patch)\(\s*(?:'([^']*)')?\s*\)[\s\S]*?async \w+\(\s*@Body\(\) \w+: (\w+)/g;
      for (const m of src.matchAll(handler)) {
        if (!dtoCarriesEmail(m[3])) continue;
        const path = ['', prefix, m[2] ?? ''].filter((p, i) => i === 0 || p).join('/');
        routes.push(`${m[1].toUpperCase()} ${path}`);
      }
      return routes;
    });

describe('C38 - every public route that takes an address is placed in the family', () => {
  it('finds the routes it is about', () => {
    expect(publicAddressRoutes()).toEqual(
      expect.arrayContaining(['POST /auth/login', 'POST /auth/forgot-password']),
    );
  });

  it('places every such route, and lists nothing that is not one', () => {
    expect(publicAddressRoutes().sort()).toEqual(Object.keys(FAMILY).sort());
  });

  it('names, for every equalised route, a spec that exists', () => {
    const missing = Object.entries(FAMILY)
      .filter(([, p]) => 'equalised' in p)
      .map(([route, p]) => [route, (p as { equalised: string }).equalised.split(' ')[0]])
      .filter(([, spec]) => {
        try {
          return !readFileSync(join(ROOT, spec), 'utf8').includes('answers as an unknown');
        } catch {
          return true;
        }
      });
    expect(missing).toEqual([]);
  });

  it('is not fooled by where it looks: the controllers it reads exist', () => {
    const controllers = [...text.keys()].filter((f) => f.endsWith('.controller.ts'));
    expect(controllers.map((f) => relative(ROOT, f))).toContain(
      'apps/api/src/core/auth/auth.controller.ts',
    );
  });
});
