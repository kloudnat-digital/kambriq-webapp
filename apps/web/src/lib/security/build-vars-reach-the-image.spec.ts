/**
 * @jest-environment node
 *
 * Every variable the web build reads must reach the build.
 *
 * `output: 'standalone'` freezes `images`, `headers()` and anything else read at
 * module scope in `next.config.ts` into the build's manifests. A variable that
 * is not an `ARG` in the Dockerfile, or is an `ARG` nothing passes, is read as
 * empty - and every one of these is designed to fail closed, so the symptom is
 * a feature that is quietly off rather than a build that fails.
 *
 * That is not hypothetical. `NEXT_PUBLIC_MAPBOX_TOKEN` was declared in
 * `Dockerfile.web` and passed by neither workflow, so every deployed image ran
 * the map widget with an empty token; and `SANITY_STUDIO_ORIGIN` was read by
 * `next.config.ts` with no `ARG` to carry it at all. Both were found by writing
 * this file.
 *
 * Pinned in both directions: an `ARG` the builder stage declares and this list
 * does not name fails too, so a new build variable cannot be added without
 * being wired.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '../../../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

const DOCKERFILE = read('docker/Dockerfile.web');

/** The builder stage only. The production stage's args are image metadata. */
const BUILDER_STAGE = DOCKERFILE.slice(0, DOCKERFILE.indexOf('AS production'));

const WORKFLOWS = ['.github/workflows/ci.yml', '.github/workflows/manual-deploy-dev.yml'];

/**
 * Each of these is read at `next build` and each is absent by design until an
 * environment sets it. The GitHub variable of the same name is what supplies it.
 */
const BUILD_TIME_VARIABLES = [
  'NEXT_PUBLIC_API_URL',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_MAPBOX_TOKEN',
  'MEDIA_BUCKET_HOST',
  'NEXT_PUBLIC_SANITY_PROJECT_ID',
  'NEXT_PUBLIC_SANITY_DATASET',
  'SANITY_STUDIO_ORIGIN',
];

describe('the build-time variables reach the image', () => {
  it.each(BUILD_TIME_VARIABLES)('%s is declared in Dockerfile.web before next build', (name) => {
    const arg = DOCKERFILE.search(new RegExp(`^ARG ${name}$`, 'm'));
    const build = DOCKERFILE.search(/^RUN .*next build/m);

    expect(arg).toBeGreaterThan(-1);
    expect(build).toBeGreaterThan(arg);
  });

  describe.each(WORKFLOWS)('%s', (workflow) => {
    const yaml = read(workflow);

    it.each(BUILD_TIME_VARIABLES)('passes %s as a build arg', (name) => {
      expect(yaml).toMatch(new RegExp(`^\\s+${name}=\\$\\{\\{ vars\\.${name} \\}\\}$`, 'm'));
    });
  });

  it('names every ARG the builder stage declares', () => {
    const declared = [...BUILDER_STAGE.matchAll(/^ARG (\w+)/gm)].map((match) => match[1]);

    // An extraction that found nothing would pass the comparison below by being
    // empty on both sides.
    expect(declared.length).toBe(BUILD_TIME_VARIABLES.length);
    expect(declared.sort()).toEqual([...BUILD_TIME_VARIABLES].sort());
  });
});
