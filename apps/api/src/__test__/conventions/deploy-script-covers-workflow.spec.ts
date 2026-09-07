import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The script is the pipeline. This test is what keeps that true.
 *
 * `scripts/deploy-dev.sh` exists because GitHub Actions can be blocked - the
 * organisation exhausted its 2 000 free minutes and no job started at all, while
 * dev sat on a build that was two merges old. The obvious response is a second
 * script that does what the workflow does. That response is wrong: two
 * implementations of one pipeline drift, quietly, and the day the fallback is
 * needed it deploys something the normal path would not have. This repository
 * has already paid for that shape once, in two role lists that had to agree.
 *
 * So the inversion: the script holds the pipeline, and the workflow calls it.
 *
 * An inversion nobody enforces is a comment. This test enforces it in **both**
 * directions:
 *
 *   - every step the workflows declare must be implemented in the script
 *   - every step the script claims to implement must exist in a workflow
 *
 * The second half is the one that catches renames. Without it, a step renamed in
 * the workflow leaves an orphan marker in the script and a step nothing covers,
 * and each half alone reads as fine.
 *
 * The contract is a marker comment, `# workflow-step: <exact step name>`, next
 * to the implementation. A step that genuinely has no local equivalent still
 * carries its marker, with the reason written beneath it - "named rather than
 * skipped silently" is the whole point, and a silent omission is exactly what
 * this test refuses.
 */
const ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SCRIPT = readFileSync(join(ROOT, 'scripts', 'deploy-dev.sh'), 'utf8');

const workflow = (name: string) => readFileSync(join(ROOT, '.github', 'workflows', name), 'utf8');

/**
 * The step names a workflow declares.
 *
 * A line-based scan rather than a YAML parse, because the alternative is adding
 * a YAML dependency to the API's test tree for one convention check. The shape
 * it relies on is asserted below, and the count is asserted too - a parser that
 * silently matched nothing would make every assertion here vacuously true, which
 * is the failure mode this file is about.
 */
export const declaredSteps = (yaml: string): string[] =>
  yaml
    .split('\n')
    .map((line) => /^\s+- name:\s*(.+?)\s*$/.exec(line)?.[1])
    .filter((name): name is string => Boolean(name))
    // `- name:` also appears inside container overrides and env lists in the
    // deploy workflow's shell bodies. Those are indented inside a `run: |`
    // block and quoted; a declared step never is.
    .filter((name) => !name.startsWith('"') && !name.startsWith("'"));

/** The step names the script claims to cover. */
const coveredSteps = (script: string): string[] =>
  [...script.matchAll(/^\s*# workflow-step:\s*(.+?)\s*$/gm)].map((m) => m[1]);

/**
 * The workflows whose steps the script must cover, and the steps that are
 * infrastructure of the workflow rather than of the pipeline.
 *
 * The exclusions are the trigger's own job: checking out, installing a runtime,
 * authenticating. Those are precisely what the workflow keeps when it is reduced
 * to a call, so requiring the script to reimplement them would be requiring the
 * duplication this test exists to prevent. They are listed by name, not matched
 * by a pattern, so adding one is a visible edit.
 */
const TRIGGER_STEPS = new Set([
  'Configure AWS credentials',
  'Resolve image tag and build metadata',
  'Install dependencies',
]);

const PIPELINE_WORKFLOWS = ['deploy-dev.yml', 'ci.yml'];

describe('the deploy script covers the workflows it replaces', () => {
  const declared = new Map<string, string[]>(
    PIPELINE_WORKFLOWS.map((f) => [f, declaredSteps(workflow(f))]),
  );

  it('is reading the files it thinks it is, and the parser is not vacuous', () => {
    expect(SCRIPT).toContain('#!/usr/bin/env bash');
    expect(SCRIPT).toContain('set -euo pipefail');

    // If this scan ever returns nothing, every `it.each` below silently passes.
    for (const [file, steps] of declared) {
      expect({ file, count: steps.length }).toEqual({ file, count: steps.length });
      expect(steps.length).toBeGreaterThan(4);
    }
    // The two steps this whole exercise is about must be among them.
    expect(declared.get('deploy-dev.yml')).toContain('Run Prisma migrations');
    expect(declared.get('deploy-dev.yml')).toContain('Bootstrap super-admin accounts');
    expect(declared.get('ci.yml')).toContain('Build and push');

    expect(coveredSteps(SCRIPT).length).toBeGreaterThan(4);
  });

  it.each(PIPELINE_WORKFLOWS)('every step %s declares is implemented in the script', (file) => {
    const covered = new Set(coveredSteps(SCRIPT));
    const missing = (declared.get(file) ?? []).filter(
      (name) => !TRIGGER_STEPS.has(name) && !covered.has(name),
    );

    // The message is the point of the test: it names what drifted.
    expect({ file, missing }).toEqual({ file, missing: [] });
  });

  it('every step the script claims to cover exists in a workflow', () => {
    const all = new Set(PIPELINE_WORKFLOWS.flatMap((f) => declared.get(f) ?? []));
    const orphans = coveredSteps(SCRIPT).filter((name) => !all.has(name));

    // Catches the rename. A step renamed on one side only leaves a marker that
    // covers nothing, and without this half both sides still look consistent.
    expect(orphans).toEqual([]);
  });

  it('the script refuses the conditions that make a deploy untraceable', () => {
    // Not decoration. Each of these is a defect this repository has already had:
    // an image built from a dirty tree matches no commit; a deploy from the
    // wrong branch ships what nobody reviewed; a default build on this arm64
    // machine produces an image Fargate cannot start, and says so only after
    // the service has been told to use it.
    expect(SCRIPT).toContain('the working tree is dirty');
    expect(SCRIPT).toContain('not develop. Pass --allow-branch');
    expect(SCRIPT).toContain('--platform linux/amd64');
    expect(SCRIPT).toContain('docker manifest inspect');

    // Same tag convention on both sides, so /health/version stays traceable to
    // a commit. `sha-` followed by exactly seven characters of the sha - the
    // two write the slice differently because bash and GitHub's expression
    // syntax differ, so the shape is asserted rather than the spelling.
    const tagConvention = /IMAGE_TAG="sha-\$\{[A-Z_]+(?:::|:0:)7\}"/;
    expect(SCRIPT).toMatch(tagConvention);
    expect(workflow('ci.yml')).toMatch(tagConvention);
  });

  it('carries no secret', () => {
    // Credentials come from the environment or the profile, as the workflow
    // gets them from OIDC. A literal here would be committed to the repository.
    expect(SCRIPT).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(SCRIPT).not.toMatch(/aws_secret_access_key\s*=/i);
    expect(SCRIPT).toContain('aws sts get-caller-identity');
  });
});
