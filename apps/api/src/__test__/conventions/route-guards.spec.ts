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

/** Counts `@Public()` occurrences, ignoring commented-out ones. */
const publicCount = (src: string) =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .split('@Public()').length - 1;

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
});
