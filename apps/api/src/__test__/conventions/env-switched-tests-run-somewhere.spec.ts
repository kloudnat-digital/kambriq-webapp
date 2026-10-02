import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * A67 - a test that an environment variable can switch off runs somewhere.
 *
 * A skip that waits for a variable no workflow sets is a test that never runs in
 * CI, and nothing about it looks wrong: the file is there, the test is there, and
 * the report counts it as skipped. So every variable a test reads to decide
 * whether to skip must be set in `.github/workflows`, or be declared below with
 * the reason it is left to a person.
 *
 * Recognised: a variable read inside the arguments of `.skip(...)` or
 * `.fixme(...)`, and a variable read in the condition of a ternary that picks a
 * `.skip`. Comments are stripped first, so an explanation does not count.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SEARCHED = ['apps', 'libs'];
const WORKFLOWS = join(ROOT, '.github', 'workflows');

/** Variables that switch tests off on purpose, each with why no workflow sets it. */
const LEFT_TO_A_PERSON: Record<string, string> = {
  RUN_BALANCE_JOURNEY:
    'journey 7 takes a deposit and a balance to validation and consumes a parcel on the environment it runs against',
};

/**
 * Variables a workflow sets from a condition on the environment under test, each
 * with why and with the exact expression. The tests they skip run again by
 * themselves on the first run where the condition holds; nobody has to remember.
 */
const SET_FROM_A_CONDITION: Record<string, { reason: string; expression: string }> = {
  E2E_CMS_CONTENT: {
    reason:
      'A71: the pages whose body is a Sanity document answer 404 on a web image built without a Sanity project and dataset',
    expression:
      "${{ vars.NEXT_PUBLIC_SANITY_PROJECT_ID != '' && vars.NEXT_PUBLIC_SANITY_DATASET != '' }}",
  },
};

/** The routes A71 skips, and the pages that actually render a Sanity document. */
const CMS_LIST = join(ROOT, 'apps', 'web-e2e', 'src', 'support', 'cms.ts');
const SITE_PAGES = join(ROOT, 'apps', 'web', 'src', 'app', '[locale]', '(site)');

const SKIP_CALL = /\.(?:skip|fixme)\(([^;]*?process\.env[^;]*?)\)\s*;/g;
const SKIP_TERNARY =
  /([^;?=]*process\.env[^;?]*)\?\s*[\w.]+\s*:\s*[\w.]*\.skip\b|([^;?=]*process\.env[^;?]*)\?\s*[\w.]*\.skip\s*:/g;
const ENV_NAME = /process\.env(?:\.([A-Z0-9_]+)|\[\s*['"`]([A-Z0-9_]+)['"`]\s*\])/g;

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const stripYamlComments = (s: string) => s.replace(/(^|\s)#.*$/gm, '$1');

const namesIn = (fragment: string) => [...fragment.matchAll(ENV_NAME)].map((m) => m[1] ?? m[2]);

/** The variables a source reads to decide whether a test runs. */
const switchesIn = (source: string): string[] => {
  const code = stripComments(source);
  const fragments = [
    ...[...code.matchAll(SKIP_CALL)].map((m) => m[1]),
    ...[...code.matchAll(SKIP_TERNARY)].map((m) => m[1] ?? m[2]),
  ];
  return [...new Set(fragments.flatMap(namesIn))].sort();
};

/** Whether a workflow sets the variable: an `env` key, or `NAME=` in a command or build argument. */
const setsVariable = (workflow: string, name: string) =>
  new RegExp(`^\\s*${name}\\s*:|\\b${name}=`, 'm').test(stripYamlComments(workflow));

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    ['node_modules', 'dist', '.next'].includes(e.name)
      ? []
      : e.isDirectory()
        ? walk(join(dir, e.name))
        : [join(dir, e.name)],
  );

const TEST_FILES = SEARCHED.flatMap((d) => walk(join(ROOT, d)))
  .filter((f) => /\.(spec|test|dbspec|setup)\.tsx?$/.test(f))
  .map((f) => relative(ROOT, f));

const WORKFLOW_TEXT = readdirSync(WORKFLOWS)
  .filter((f) => /\.ya?ml$/.test(f))
  .map((f) => readFileSync(join(WORKFLOWS, f), 'utf8'));

/** This file's own examples are strings that look like switches. */
const THIS_FILE = relative(ROOT, __filename);

const SWITCHES = TEST_FILES.filter((file) => file !== THIS_FILE).flatMap((file) =>
  switchesIn(readFileSync(join(ROOT, file), 'utf8')).map((name) => ({ file, name })),
);

const setBySomeWorkflow = (name: string) => WORKFLOW_TEXT.some((w) => setsVariable(w, name));

describe('A67 - a test an environment variable can switch off runs somewhere', () => {
  it('recognises every shape a switch takes, and not a mention or another kind of skip', () => {
    const src = [
      "test.skip(process.env['RUN_A'] !== '1', 'opt-in: RUN_A=1');",
      "const run = process.env.RUN_B === '1' ? describe : describe.skip;",
      'test.fixme(!process.env.RUN_C);',
      'const d = process.env.RUN_D ? it.skip : it;',
      "describe.skip('no variable here', () => {});",
      "test.skip(({ browserName }) => browserName !== 'chromium', 'one browser');",
      "// test.skip(process.env['RUN_E'] !== '1');",
      "const base = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';",
    ].join('\n');
    expect(switchesIn(src)).toEqual(['RUN_A', 'RUN_B', 'RUN_C', 'RUN_D']);
  });

  it('recognises a workflow setting a variable, and not a comment naming it', () => {
    const yml = [
      'env:',
      "  RUN_A: '1'",
      'steps:',
      '  - run: RUN_B=1 pnpm test:e2e',
      '  # RUN_C: 1 would switch it on',
    ].join('\n');
    expect(['RUN_A', 'RUN_B', 'RUN_C'].filter((n) => setsVariable(yml, n))).toEqual([
      'RUN_A',
      'RUN_B',
    ]);
  });

  it('searches every test in the repository, the browser and journey suites included', () => {
    expect(TEST_FILES.length).toBeGreaterThan(200);
    expect(TEST_FILES).toContain('apps/web-e2e/src/human-paths.spec.ts');
    expect(TEST_FILES).toContain('apps/api-e2e/src/journeys/balance-journey.spec.ts');
    expect(WORKFLOW_TEXT.length).toBeGreaterThan(0);
  });

  it('every switch is set by a workflow, or declared with its reason', () => {
    const neverSet = SWITCHES.filter(
      ({ name }) => !(name in LEFT_TO_A_PERSON) && !setBySomeWorkflow(name),
    );
    expect(neverSet).toEqual([]);
  });

  it('every conditional switch is set by a workflow from exactly its declared condition', () => {
    const wrong = Object.entries(SET_FROM_A_CONDITION)
      .filter(([name, { expression }]) => {
        const line = new RegExp(`^\\s*${name}\\s*:\\s*(.+)$`, 'm');
        const set = WORKFLOW_TEXT.map((w) => stripYamlComments(w).match(line)?.[1].trim()).filter(
          Boolean,
        );
        const read = SWITCHES.some((sw) => sw.name === name);
        return !read || set.length === 0 || set.some((v) => v !== expression);
      })
      .map(([name]) => name);
    expect(wrong).toEqual([]);
  });

  it('A71 skips exactly the pages that render a Sanity document, and no other', () => {
    const listed = [...readFileSync(CMS_LIST, 'utf8').matchAll(/^\s*'(\/[^']*)',$/gm)]
      .map((m) => m[1])
      .sort();
    const reading = walk(SITE_PAGES)
      .filter((f) => f.endsWith('page.tsx'))
      // C41: the legal pages read the CMS through `LegalPolicyPage`, which picks
      // the revision in force; they are CMS pages all the same.
      .filter((f) => {
        const src = readFileSync(f, 'utf8');
        return (
          src.includes("'@/lib/cms/documents'") ||
          src.includes("'@/components/cms/legal-policy-page'")
        );
      })
      .map((f) => '/' + relative(SITE_PAGES, f).replace(/\/?page\.tsx$/, ''))
      .sort();
    expect(reading.length).toBeGreaterThan(0);
    expect(listed).toEqual(reading);
  });

  it('every declared switch is still read by a test and still set by no workflow', () => {
    const read = new Set(SWITCHES.map(({ name }) => name));
    const stale = Object.keys(LEFT_TO_A_PERSON).filter(
      (name) => !read.has(name) || setBySomeWorkflow(name),
    );
    expect(stale).toEqual([]);
  });
});
