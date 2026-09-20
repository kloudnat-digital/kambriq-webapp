import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Authentication is opt-OUT in this API, so the risk is the opt-out.
 *
 * `JwtAuthGuard` and `RolesGuard` are global (`APP_GUARD` in `app.module.ts`),
 * which means every route is authenticated unless a decorator removes it. That
 * is the right default and it makes `@Public()` the only thing worth guarding:
 * one added by accident, or added deliberately and never reviewed again, opens a
 * route silently. Nothing fails, nothing logs, and the route simply stops asking.
 *
 * So this pins the public surface as a list. Adding a `@Public()` route is then a
 * change to this file — a reviewed decision — rather than a line nobody sees.
 * It also pins the class-level `@Roles` on the admin controllers, because a
 * deleted `@Roles` line downgrades an admin controller to "any authenticated
 * user" without changing a single response shape.
 */
const API_SRC = join(__dirname, '..', '..');

const walk = (dir: string): string[] => {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (e.endsWith('.controller.ts')) out.push(full);
  }
  return out;
};

const CONTROLLERS = walk(API_SRC)
  .filter((f) => !f.includes('__test__'))
  .map((f) => ({ path: relative(API_SRC, f), src: readFileSync(f, 'utf8') }));

/** `@Controller('x')` -> `x`; a bare `@Controller()` -> `''`. */
const basePath = (src: string) => /@Controller\(\s*'([^']*)'\s*\)/.exec(src)?.[1] ?? '';

/**
 * Source with its comments removed.
 *
 * Extracted so the route-role sweep below uses the same stripping as
 * `publicCount` rather than a second copy that can drift from it.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** Counts `@Public()` occurrences, ignoring commented-out ones. */
const publicCount = (src: string) =>
  (
    stripComments(src)
      /**
       * A decorator **position**, not a mention.
       *
       * This used to be `.split('@Public()')`, which counted the token wherever
       * it appeared - including inside a string. A route description explaining
       * that a route is deliberately *not* `@Public()` therefore read as a
       * fourth public route on the health controller, and the sweep reported
       * the sentence saying "this is not public" as a public route.
       *
       * Comments were already stripped; strings cannot be, because a decorator
       * and a mention are the same characters. What separates them is position:
       * a decorator opens its own line. That is what is counted.
       */
      .match(/^[ \t]*@Public\(\)/gm) ?? []
  ).length;

/**
 * The complete public surface, by controller and count.
 *
 * These are the only routes in the API that answer without a token. Every one is
 * here because it must be reachable before a session exists (register, login,
 * refresh, the verification and reset flows, reactivation), or because it is
 * deliberately anonymous (health probes, public certificate verification,
 * newsletter signup).
 */
const PUBLIC_SURFACE: Record<string, number> = {
  'core/auth/auth.controller.ts': 9,
  // L1: the public contact form's one route. A prospect has no account - that
  // is what the form is for - and it is throttled to 3/minute for the same
  // reason the newsletter is: an unauthenticated write is a mailbox anybody
  // can address.
  'core/contact/contact.controller.ts': 1,
  'health/health.controller.ts': 3,
  'kbs/controllers/kbs-public.controller.ts': 1,
  'newsletter/newsletter.controller.ts': 1,
};

/** Controllers whose class-level `@Roles` is the whole authorization story. */
const CLASS_ROLES: Record<string, string[]> = {
  'kbs/controllers/kbs-admin.controller.ts': ['ADMIN_KBS', 'ADMIN_GLOBAL'],
  'kamnet/controllers/kamnet-admin.controller.ts': ['ADMIN_KAMNET', 'ADMIN_GLOBAL'],
  'lands/controllers/lands-admin.controller.ts': ['ADMIN_LANDS', 'ADMIN_GLOBAL'],
  'lands/controllers/lands-agent.controller.ts': ['AGENT'],
  'lands/controllers/lands-client.controller.ts': ['CLIENT'],
  'lands/controllers/payments-admin.controller.ts': ['ADMIN_LANDS', 'ADMIN_GLOBAL'],
};

/** A routed method, and whatever its own `@Roles` demands. */
type RouteRole = { route: string; roles: string | null };

const ROUTE_DECORATOR = /^[ \t]*@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)/gm;

/**
 * Every routed method in a controller, paired with its route-level roles.
 *
 * Positions, not tokens - the same lesson `publicCount` records above. A
 * decorator and a mention of one are identical characters; what separates them
 * is that a decorator opens its own line. The roles of a route are read from
 * the span between its HTTP decorator and the next one, so a decorator on the
 * route below is never miscredited to the route above.
 */
const routeRoles = (src: string): RouteRole[] => {
  const stripped = stripComments(src);
  const marks = [...stripped.matchAll(ROUTE_DECORATOR)].map((m) => ({
    method: m[1].toUpperCase(),
    path: m[2] ?? '',
    index: m.index ?? 0,
  }));

  return marks.map((mark, i) => ({
    route: `${mark.method} ${mark.path}`,
    roles:
      /^[ \t]*@Roles\(([^)]*)\)/m.exec(
        stripped.slice(mark.index, marks[i + 1]?.index ?? stripped.length),
      )?.[1] ?? null,
  }));
};

const CANDIDATE_CONTROLLER = 'kbs/controllers/kbs-candidate.controller.ts';

/**
 * I17 - the candidate routes that deliberately carry NO role.
 *
 * Every other route on this controller requires `CANDIDATE_KBS`. These four
 * cannot, for two distinct reasons, and both are the same trap seen from
 * different sides: a role here locks out every NEW candidate while every
 * already-enrolled one keeps working, so the platform looks healthy and is
 * broken for exactly the population being added.
 *
 * THE GRANT PATH. `POST /kbs/enroll` is the route that GRANTS the role
 * (`candidates.service.ts:90`), so a caller cannot already hold it, and
 * `POST /kbs/cv/upload-url` runs before enrolling - its `fileUrl` is sent in the
 * enrolment body.
 *
 * THE PROBES. `GET /kbs/me` and `GET /kbs/certificate/me` answer the question
 * "am I enrolled / do I have a certificate", which only has a point when the
 * answer may be no. Both reply 404 for a non-candidate, and the web's
 * `nullOn404` reads exactly 404 as "not enrolled" while `createAction` rethrows
 * everything else. Guarding them turns that 404 into a 403 that is rethrown, so
 * `/kbs/enroll` - the page the public call to action links at - would render an
 * error instead of its form. Measured, not assumed: `create-action.ts:40`.
 *
 * Pinned as a list so adding a role-free candidate route is a change to this
 * file - a reviewed decision - rather than a line nobody sees.
 */
const ROLE_FREE_CANDIDATE_ROUTES = [
  'POST enroll',
  'POST cv/upload-url',
  'GET me',
  'GET certificate/me',
];

/** Throws rather than skipping: a controller that moved must fail, not pass quietly. */
const candidateController = () => {
  const controller = CONTROLLERS.find((c) => c.path === CANDIDATE_CONTROLLER);
  if (!controller) throw new Error(`Controller not found: ${CANDIDATE_CONTROLLER}`);
  return controller;
};

describe('route guards', () => {
  it('found the controllers at all', () => {
    // A scanner that finds nothing makes every assertion below vacuous.
    expect(CONTROLLERS.length).toBeGreaterThanOrEqual(13);
    expect(CONTROLLERS.map((c) => c.path)).toContain('core/users/users.controller.ts');
  });

  it('the global guards are wired, so authentication is opt-out', () => {
    const appModule = readFileSync(join(API_SRC, 'app', 'app.module.ts'), 'utf8');
    expect(appModule).toContain('{ provide: APP_GUARD, useClass: JwtAuthGuard }');
    expect(appModule).toContain('{ provide: APP_GUARD, useClass: RolesGuard }');
  });

  it.each(CONTROLLERS.map((c) => [c.path, c.src] as const))(
    '%s exposes exactly the declared number of public routes',
    (path, src) => {
      expect(publicCount(src)).toBe(PUBLIC_SURFACE[path] ?? 0);
    },
  );

  it.each(Object.entries(CLASS_ROLES))('%s still declares its class-level roles', (path, roles) => {
    const controller = CONTROLLERS.find((c) => c.path === path);
    if (!controller) throw new Error(`Controller not found: ${path}`);
    const decorator = /@Roles\(([^)]*)\)/.exec(controller.src)?.[1] ?? '';
    for (const role of roles) expect(decorator).toContain(`RoleCode.${role}`);
  });

  it('every controller declares a base path, so no route lands at the API root by accident', () => {
    const rootControllers = CONTROLLERS.filter((c) => basePath(c.src) === '').map((c) => c.path);
    // app.controller.ts is the one deliberate root controller.
    expect(rootControllers).toEqual(['app/app.controller.ts']);
  });

  // ----- I17: the candidate surface carries a role -----

  /** A sweep that finds nothing makes every assertion below it vacuous. */
  it('found the candidate routes at all', () => {
    expect(routeRoles(candidateController().src).length).toBeGreaterThanOrEqual(21);
  });

  it('the role-free candidate routes are exactly the pre-candidate surface', () => {
    const roleFree = routeRoles(candidateController().src)
      .filter((r) => r.roles === null)
      .map((r) => r.route);

    expect(roleFree).toEqual(ROLE_FREE_CANDIDATE_ROUTES);
  });

  it('every other candidate route demands CANDIDATE_KBS', () => {
    const routes = routeRoles(candidateController().src);
    const guarded = routes.filter((r) => r.roles !== null);

    /**
     * A loop over an empty list satisfies every assertion inside it. Without
     * this line the whole test passes while NOT ONE route carries a role,
     * which is exactly the state this subject exists to end.
     */
    expect(guarded).toHaveLength(routes.length - ROLE_FREE_CANDIDATE_ROUTES.length);

    for (const route of guarded) {
      expect(`${route.route} -> ${route.roles}`).toContain('RoleCode.CANDIDATE_KBS');
    }
  });

  /**
   * The trap, pinned separately so it can be observed failing on its own.
   *
   * A class-level `@Roles(RoleCode.CANDIDATE_KBS)` passes the two assertions
   * above - every route would inherit the role - and locks every new candidate
   * out of enrolment, because `POST /kbs/enroll` is what grants the role.
   */
  it('never puts the candidate role at the class level', () => {
    const beforeClass = stripComments(candidateController().src).split('export class')[0];

    expect(beforeClass).not.toMatch(/^[ \t]*@Roles\(/m);
  });
});
