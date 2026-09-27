import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The migration step's completion line (eleventh round; the family of A9, A54,
 * H2): a one-off task that exits 0 has declared success, not achieved it.
 * `run-migrations.js` now prints one line after every schema has migrated, and
 * the deploy step reads it from the task's own log stream
 * (`scripts/ci/await-task-tally.sh`), after the exit code.
 */
const ROOT = join(__dirname, '../../../../..');

jest.mock('child_process', () => ({ execSync: jest.fn() }));

const { execSync } = require('child_process') as { execSync: jest.Mock };

const script = require(join(ROOT, 'prisma/run-migrations.js')) as {
  runMigrations: () => string[];
  COMPLETION_LINE: string;
  completionLine: (schemas: string[]) => string;
};

describe('the migration step says it finished, and only then', () => {
  let log: jest.SpyInstance;
  beforeEach(() => {
    execSync.mockReset();
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });
  afterEach(() => log.mockRestore());

  it('migrates the four schemas and names them', () => {
    const schemas = script.runMigrations();
    expect(schemas).toEqual(['core', 'kamnet', 'kbs', 'lands']);
    expect(execSync).toHaveBeenCalledTimes(4);
    expect(script.completionLine(schemas)).toBe(
      'Kambriq migrations complete: 4 schemas (core, kamnet, kbs, lands)',
    );
  });

  it('prints no completion line when a schema fails', () => {
    execSync
      .mockImplementationOnce(() => undefined)
      .mockImplementationOnce(() => {
        throw new Error('migrate deploy failed');
      });
    expect(() => script.runMigrations()).toThrow('migrate deploy failed');
    const printed = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(printed).not.toContain(script.COMPLETION_LINE);
  });

  it('the deploy step waits for exactly the line the script prints', () => {
    const workflow = readFileSync(join(ROOT, '.github/workflows/deploy-dev.yml'), 'utf8');
    const step = workflow.slice(workflow.indexOf('- name: Run Prisma migrations'));
    const until = step.slice(0, step.indexOf('\n      - name:', 10));
    expect(until).toContain('scripts/ci/await-task-tally.sh');
    expect(until).toContain(`"${script.COMPLETION_LINE}"`);
  });
});
