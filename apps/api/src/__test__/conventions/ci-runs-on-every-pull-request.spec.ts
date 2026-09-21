import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A38 - CI must run on a pull request whatever its base branch.
 *
 * `on.pull_request.branches` filters on the BASE branch. With
 * `branches: [main, develop]`, a PR stacked on a feature branch matched no
 * trigger, so the workflow never started: no `changes`, no `commitlint`, no
 * `quality`, no `test-db`, no `gate`. GitHub then reported the PR mergeable,
 * because no required check was missing - there were no checks at all.
 *
 * Measured on this repository during the 20 September wave: #155, based on
 * `develop`, carried ten checks. #156, #157, #158 and #159, each stacked on the
 * previous branch, carried **zero**, and all four were merged having been gated
 * only by local runs. Querying the API by head sha showed it plainly: the
 * pre-rebase head of #156 had no run in its entire life, and the same work
 * re-targeted at `develop` got one within minutes.
 *
 * This is worse than a green that misleads. There is nothing at all, and the
 * interface says everything is fine.
 *
 * ---------------------------------------------------------------------------
 * The second half is the one that matters
 * ---------------------------------------------------------------------------
 * Widening the trigger is safe only because every expensive job is gated on the
 * PUSH event and the develop ref, not on the trigger's branch filter. A build,
 * an ECR push, a deploy, the delivery journeys and the e2e suite each carry
 * `if: github.event_name == 'push' && github.ref == 'refs/heads/develop'`.
 *
 * So the assertion that stops this becoming expensive is not the trigger one -
 * it is the five below. Somebody "simplifying" a job's `if:` later would turn
 * every pull request into a deploy, and nothing else in the repository would
 * notice until the bill or the environment did.
 *
 * ---------------------------------------------------------------------------
 * Why this parses text rather than YAML
 * ---------------------------------------------------------------------------
 * There is no YAML parser in this repository - neither `js-yaml` nor `yaml` is
 * a dependency, and nothing imports one. Adding one for a convention test is a
 * dependency bought for a single assertion. `image-carries-seed-deps.spec.ts`
 * and `env-vars-declared.spec.ts` already read build files as text for the same
 * reason, and this follows them.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const CI = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8');

/** The `on:` block: from the `on:` line to the next key at column zero. */
const triggerBlock = (): string => {
  const start = CI.search(/^on:$/m);
  if (start < 0) throw new Error('ci.yml has no `on:` block');
  const rest = CI.slice(start + 'on:'.length);
  const end = rest.search(/^[A-Za-z]/m);
  return end < 0 ? rest : rest.slice(0, end);
};

/** One job's block: from `  <name>:` to the next job declared at that indent. */
const jobBlock = (name: string): string => {
  const start = CI.search(new RegExp(`^ {2}${name}:$`, 'm'));
  if (start < 0) throw new Error(`ci.yml has no job \`${name}\``);
  const rest = CI.slice(start);
  const end = rest.slice(1).search(/^ {2}[a-z0-9_-]+:$/m);
  return end < 0 ? rest : rest.slice(0, end + 1);
};

/**
 * Every job that builds, pushes, deploys or runs against the deployed
 * environment. Each must stay gated on push-to-develop.
 */
const EXPENSIVE_JOBS = ['build-api', 'build-web', 'deploy-dev', 'journeys', 'e2e'] as const;

const PUSH_TO_DEVELOP = "if: github.event_name == 'push' && github.ref == 'refs/heads/develop'";

describe('A38 - CI runs on every pull request, and still deploys only from develop', () => {
  /** A test that reads the wrong file, or an empty one, asserts nothing below. */
  it('is reading the workflow it thinks it is', () => {
    expect(CI).toContain('name: CI');
    for (const job of EXPENSIVE_JOBS) {
      expect(CI).toMatch(new RegExp(`^ {2}${job}:$`, 'm'));
    }
    expect(triggerBlock()).toContain('pull_request:');
  });

  it('does not restrict the pull_request trigger to any base branch', () => {
    const [, afterPullRequest] = triggerBlock().split(/^\s*pull_request:\s*$/m);

    expect(afterPullRequest ?? '').not.toMatch(/^\s*branches:/m);
  });

  /**
   * `push` is deliberately left alone. Running every feature branch through the
   * pipeline is a real cost and is not what A38 is about.
   */
  it('still restricts the push trigger to main and develop', () => {
    const pushBlock = triggerBlock().split(/^\s*pull_request:\s*$/m)[0];

    expect(pushBlock).toMatch(/^\s*branches:\s*\[main, develop\]\s*$/m);
  });

  it.each(EXPENSIVE_JOBS)('%s still runs only on a push to develop', (job) => {
    expect(jobBlock(job)).toContain(PUSH_TO_DEVELOP);
  });
});
