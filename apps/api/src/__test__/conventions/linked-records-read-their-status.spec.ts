import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * C32, C33, I48 - a read that returns a linked record must read whether it
 * still stands.
 *
 * Four times in one month, the same shape: a cancelled reservation shown as the
 * one holding a parcel (C32), a revoked certificate shown as current (C33), a
 * count of reservations including cancelled ones and a sponsor returned without
 * its suspension (I48). Each was a Prisma `include` or `select` of a relation
 * whose target carries a stand-down marker, neither filtered on it nor returning
 * it.
 *
 * The markers are read from the four schemas, not listed here: a `revokedAt`,
 * `suspendedAt` or `deletedAt` column, and any field typed by an enum that has a
 * stand-down value. A relation to such a model, in `apps/api/src`, must either
 * mention the marker (a `where` on it, or a `select` of it) or return every
 * scalar (no `select`); inside `_count` it must filter on it. Anything else is a
 * finding, unless declared below with its reason and its exact count.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SCHEMAS = ['core', 'kbs', 'kamnet', 'lands'].map((m) =>
  readFileSync(join(ROOT, 'prisma', m, 'schema.prisma'), 'utf8'),
);
const STAND_DOWN_COLUMNS = new Set(['revokedAt', 'suspendedAt', 'deletedAt']);
const STAND_DOWN_VALUES = /^(CANCELLED|ANNULE|REVOKED|SUSPENDED|REJECTED|REJETE|EXPIRE)$/;

/**
 * Reads that return a linked record without its standing, known and not fixed.
 * Keyed by file, then relation, with the exact number of such reads there - so
 * a new one in the same file fails as surely as one in a new file.
 */
const DECLARED: Record<string, Record<string, { count: number; reason: string }>> = {
  'apps/api/src/core/auth/auth.service.ts': {
    user: {
      count: 2,
      reason:
        'verifyEmail reads only the language of its error message; resetPassword reads isActive, the flag sign-in refuses on, which covers a deleted account (C35)',
    },
  },
  'apps/api/src/core/users/users.service.ts': {
    user: {
      count: 2,
      reason:
        'the identity-review queue filters deleted accounts in its where (C36) while its include selects contact fields; the single review reads the document of the account it is asked for',
    },
  },
  'apps/api/src/kamnet/commissions/commissions.service.ts': {
    agent: {
      count: 1,
      reason:
        "a commission list names its agent; a suspended agent's commissions are still owed - whether to show the suspension is Visquis's",
    },
  },
  'apps/api/src/kamnet/agents/agents.service.ts': {
    referrals: {
      count: 2,
      reason: "a referral count is history; whether a suspended referral still counts is Visquis's",
    },
  },
};

type Model = { name: string; fields: Array<{ name: string; type: string }> };

const models: Model[] = SCHEMAS.flatMap((s) =>
  [...s.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map((m) => ({
    name: m[1],
    fields: m[2]
      .split('\n')
      .map((l) => l.trim().split(/\s+/))
      .filter((t) => t.length >= 2 && !/^(\/\/|@@)/.test(t[0]))
      .map(([name, type]) => ({ name, type: type.replace(/[[\]?]/g, '') })),
  })),
);

const standDownEnums = new Set(
  SCHEMAS.flatMap((s) =>
    [...s.matchAll(/^enum (\w+) \{([\s\S]*?)^\}/gm)]
      .filter((m) =>
        m[2]
          .split('\n')
          .map((l) => l.trim().split(/\s+/)[0])
          .some((v) => STAND_DOWN_VALUES.test(v)),
      )
      .map((m) => m[1]),
  ),
);

/** Each model's stand-down fields. */
const markersOf = new Map(
  models.map((m) => [
    m.name,
    m.fields
      .filter((f) => STAND_DOWN_COLUMNS.has(f.name) || standDownEnums.has(f.type))
      .map((f) => f.name),
  ]),
);

/** Relation name -> the stand-down fields of the model(s) it points at. */
const relations = new Map<string, Set<string>>();
for (const model of models) {
  for (const field of model.fields) {
    const markers = markersOf.get(field.type);
    if (!markers || markers.length === 0) continue;
    const known = relations.get(field.name) ?? new Set<string>();
    markers.forEach((mk) => known.add(mk));
    relations.set(field.name, known);
  }
}

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const objectAt = (src: string, open: number): string => {
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  return src.slice(open);
};

/** The relations a source reads without their standing, counted per relation. */
export const unfilteredReads = (source: string): Record<string, number> => {
  const src = stripComments(source);
  const found: Record<string, number> = {};
  for (const [relation, markers] of relations) {
    for (const m of src.matchAll(new RegExp(`\\b${relation}:\\s*(true|\\{)`, 'g'))) {
      const inCount = /_count\s*:\s*\{\s*select\s*:\s*\{[^}]*$/.test(src.slice(0, m.index));
      const body = m[1] === '{' ? objectAt(src, (m.index ?? 0) + m[0].length - 1) : '';
      const mentions = [...markers].some((mk) => new RegExp(`\\b${mk}\\b`).test(body));
      const allScalars = m[1] === 'true' || !/\bselect\b/.test(body);
      const standing = inCount ? mentions : mentions || allScalars;
      if (!standing) found[relation] = (found[relation] ?? 0) + 1;
    }
  }
  return found;
};

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === '__test__'
        ? []
        : walk(join(dir, e.name))
      : e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts')
        ? [join(dir, e.name)]
        : [],
  );

const FINDINGS = Object.fromEntries(
  walk(join(ROOT, 'apps', 'api', 'src'))
    .map((f) => [relative(ROOT, f), unfilteredReads(readFileSync(f, 'utf8'))] as const)
    .filter(([, reads]) => Object.keys(reads).length > 0),
);

describe('C33 - a read that returns a linked record reads whether it still stands', () => {
  it('derives the stand-down markers from the schemas', () => {
    expect(relations.get('reservations')).toEqual(new Set(['status']));
    expect(relations.get('certificates')).toEqual(new Set(['revokedAt']));
    expect(relations.get('sponsor')).toEqual(new Set(['suspendedAt']));
  });

  it('recognises each shape, and not a filtered or a whole read', () => {
    const src = `
      a({ include: { certificates: { orderBy: x, take: 1, select: { kcaNumber: true } } } });
      b({ include: { certificates: { take: 1, select: { kcaNumber: true, revokedAt: true } } } });
      c({ include: { certificates: { take: 1 } } });
      d({ _count: { select: { reservations: true } } });
      e({ _count: { select: { reservations: { where: { status: { not: 'CANCELLED' } } } } } });
      f({ include: { sponsor: { select: { id: true } } } });
      // g({ include: { sponsor: { select: { id: true } } } });
    `;
    expect(unfilteredReads(src)).toEqual({ certificates: 1, reservations: 1, sponsor: 1 });
  });

  it('no read in the API returns a linked record without its standing, beyond those declared', () => {
    const undeclared = Object.entries(FINDINGS).flatMap(([file, reads]) =>
      Object.entries(reads)
        .filter(([relation, count]) => DECLARED[file]?.[relation]?.count !== count)
        .map(([relation, count]) => `${file}: ${relation} x${count}`),
    );
    expect(undeclared).toEqual([]);
  });

  it('every declaration still matches a read, at its exact count', () => {
    const stale = Object.entries(DECLARED).flatMap(([file, reads]) =>
      Object.entries(reads)
        .filter(([relation, { count }]) => FINDINGS[file]?.[relation] !== count)
        .map(([relation]) => `${file}: ${relation}`),
    );
    expect(stale).toEqual([]);
  });
});
