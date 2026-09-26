/**
 * @jest-environment node
 */
import {
  SANITY_DATASET_VAR,
  SANITY_PROJECT_ID_VAR,
  sanityDataset,
} from '@/lib/security/sanity-hosts';
import { cmsClient } from './client';

/**
 * What the delivery client does with the two variables that configure it.
 *
 * The states are not symmetrical and that is the point: no project at all is a
 * site without a CMS, which this app supports; a project with no dataset is a
 * half-configured build, and this repository's rule is that the unconfigured
 * case is the loud one.
 */
const PROJECT = '7k3m2q1p';
const env = (values: Record<string, string>) => values as NodeJS.ProcessEnv;

describe('the Sanity delivery client', () => {
  it('is null when no project is configured, so pages answer 404', () => {
    expect(sanityDataset(env({}))).toBeNull();
    expect(cmsClient(env({}))).toBeNull();
  });

  it('refuses a project with no dataset rather than guessing production', () => {
    // A default here would point a deployed site at a dataset nobody chose.
    expect(() => sanityDataset(env({ [SANITY_PROJECT_ID_VAR]: PROJECT }))).toThrow(
      SANITY_DATASET_VAR,
    );
    expect(() => cmsClient(env({ [SANITY_PROJECT_ID_VAR]: PROJECT }))).toThrow(SANITY_DATASET_VAR);
  });

  it.each([
    ['a path', 'production/legal'],
    ['an origin', 'https://production'],
    ['an upper-case name', 'Production'],
    ['a space', 'my dataset'],
    ['a leading hyphen', '-production'],
  ])('refuses %s as a dataset name', (_label, dataset) => {
    expect(() =>
      sanityDataset(env({ [SANITY_PROJECT_ID_VAR]: PROJECT, [SANITY_DATASET_VAR]: dataset })),
    ).toThrow(SANITY_DATASET_VAR);
  });

  it('builds a client against the configured project and dataset', () => {
    const configured = env({
      [SANITY_PROJECT_ID_VAR]: PROJECT,
      [SANITY_DATASET_VAR]: 'production',
    });

    expect(sanityDataset(configured)).toBe('production');

    const client = cmsClient(configured);
    expect(client?.config()).toMatchObject({
      projectId: PROJECT,
      dataset: 'production',
      useCdn: true,
    });

    /**
     * The URL, not the field. `@sanity/client` strips a leading `v` from
     * `apiVersion` (`.replace(/^v/, '')`) and re-adds it when it builds the
     * URL, so `config().apiVersion` reads `2025-02-19` while the request goes
     * to `/v2025-02-19`. Asserting the field would have pinned the library's
     * normalisation; this pins what goes on the wire.
     *
     * The version matters: from `v2025-02-19` the default perspective is
     * `published` rather than `raw`, which is what keeps a draft away from a
     * visitor.
     */
    expect(client?.config().cdnUrl).toBe(`https://${PROJECT}.apicdn.sanity.io/v2025-02-19`);
  });

  it('sends no token, because everything it reads is public', () => {
    const client = cmsClient(
      env({ [SANITY_PROJECT_ID_VAR]: PROJECT, [SANITY_DATASET_VAR]: 'production' }),
    );
    expect(client?.config().token).toBeUndefined();
  });
});
