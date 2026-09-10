import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

/**
 * **One `@Processor` per queue name.**
 *
 * BullMQ hands a job to one worker. Two `@Processor(QUEUES.X)` classes means
 * whichever wins a given job keeps it - and a processor that returns early for
 * job names it does not recognise then **consumes and discards** the other's
 * work, leaving no failure, no retry and no log line.
 *
 * G6 did exactly this and it was found by running the thing, not by reading it:
 * `DunningProcessor` was declared on `QUEUES.NOTIFICATIONS` beside
 * `EmailProcessor` and swallowed a payment reminder. One email arrived instead
 * of two, the `wait` list was empty, the `failed` set was empty, and nothing
 * anywhere said a message had been dropped.
 *
 * That is the precise failure the chantier exists to abolish, introduced by the
 * chantier. This test is the barrier, so the next person who adds a scheduled
 * job to an existing queue is stopped at the commit rather than by a client who
 * never got their reminder.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const f = join(dir, e);
    return statSync(f).isDirectory() ? walk(f) : extname(e) === '.ts' ? [f] : [];
  });

const SOURCES = [join(ROOT, 'apps', 'api', 'src'), join(ROOT, 'libs', 'common', 'src')]
  .flatMap(walk)
  .filter((f) => !f.includes('__test__') && !f.endsWith('.spec.ts'));

/**
 * Comments are stripped before the scan, and that is not tidiness.
 *
 * The regex below looks for `@Processor(QUEUES.X)` in raw text, so it also
 * matched the phrase written **in a doc comment explaining the rule**. L2 added
 * three such comments - one on the processor, one on the scheduler, one on the
 * queue constant - and this test went red naming `cleanup.processor.ts` twice
 * and a constants file as rival owners of `CORE`. Nothing was wrong with the
 * code; the sweep was reading prose as declarations.
 *
 * It is the defect the brief already catalogues as *"a sweep that counts a
 * token counts it in prose too"*, in the file whose whole job is counting
 * tokens, and `env-vars-declared.spec.ts` had already paid for the same lesson
 * and strips comments for the same reason.
 *
 * The direction of the failure matters: this produced a **false positive**, so
 * it was found immediately. The same blindness could have hidden a real second
 * processor behind a commented-out one, and that would not have been.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('one processor per queue', () => {
  const owners = new Map<string, string[]>();

  beforeAll(() => {
    for (const file of SOURCES) {
      const src = stripComments(readFileSync(file, 'utf8'));
      for (const m of src.matchAll(/@Processor\(\s*QUEUES\.([A-Z_]+)\s*\)/g)) {
        const queue = m[1];
        owners.set(queue, [...(owners.get(queue) ?? []), relative(ROOT, file)]);
      }
    }
  });

  it('is finding the processors it thinks it is', () => {
    // A sweep that matched nothing would make the assertion below vacuously
    // true - the failure mode this whole file is about.
    expect(owners.size).toBeGreaterThanOrEqual(4);
    expect([...owners.keys()]).toEqual(expect.arrayContaining(['NOTIFICATIONS', 'DUNNING']));
  });

  it('still sees a real declaration after comments are stripped', () => {
    // The other half of the stripping. Removing comments must not remove the
    // thing being looked for, and the only way to know is to look for one that
    // is definitely there: CORE is declared by exactly one file, in code.
    expect(owners.get('CORE')).toEqual(['apps/api/src/core/cleanup/cleanup.processor.ts']);
  });

  it('does not read a commented-out processor as a declaration', () => {
    // Directly, on a string, so the claim is about the sweep rather than about
    // whatever the repository happens to contain today.
    const commented = `// @Processor(QUEUES.CORE)\n/* @Processor(QUEUES.KBS) */\nconst x = 1;`;
    expect([
      ...stripComments(commented).matchAll(/@Processor\(\s*QUEUES\.([A-Z_]+)\s*\)/g),
    ]).toEqual([]);
  });

  it('no queue has two processors', () => {
    const shared = [...owners.entries()]
      .filter(([, files]) => files.length > 1)
      .map(([queue, files]) => `${queue}: ${files.join(' + ')}`);

    expect(shared).toEqual([]);
  });

  it('the dunning sweep refuses a job it does not own rather than dropping it', () => {
    const src = readFileSync(
      join(ROOT, 'apps', 'api', 'src', 'lands', 'payments', 'dunning.processor.ts'),
      'utf8',
    );
    // The early `return undefined` is what made the swallow silent. If a job
    // ever reaches the wrong processor again, it must be loud.
    expect(src).toMatch(/throw new Error\(/);
    expect(src).not.toMatch(/return undefined;/);
  });
});
