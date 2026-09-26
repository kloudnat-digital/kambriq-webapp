/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SANITY_CDN_HOST,
  SANITY_DATASET_VAR,
  SANITY_PROJECT_ID_VAR,
  sanityDataset,
  sanityImagePathPrefix,
  sanityProjectId,
} from './sanity-hosts';

const PROJECT = '7k3m2q1p';
const withProject = { [SANITY_PROJECT_ID_VAR]: PROJECT } as NodeJS.ProcessEnv;
const withoutProject = {} as NodeJS.ProcessEnv;

const NEXT_CONFIG = readFileSync(join(__dirname, '../../../next.config.ts'), 'utf8');

describe('the Sanity hosts the browser may reach', () => {
  it('scopes the asset CDN by project, because the host is shared by everybody', () => {
    // cdn.sanity.io serves every Sanity customer's assets. The optimizer decodes
    // what it fetches, so the project has to be in the path.
    expect(sanityImagePathPrefix(withProject)).toBe(`/images/${PROJECT}/`);
    expect(SANITY_CDN_HOST).toBe('cdn.sanity.io');
  });

  it('refuses a project with no dataset, at the build rather than at a request', () => {
    // next.config.ts calls sanityDataset for this throw. Read only at runtime it
    // would have been a 500 on the first page somebody opened.
    expect(() => sanityDataset(withProject)).toThrow(SANITY_DATASET_VAR);
    expect(NEXT_CONFIG).toContain('sanityDataset(process.env)');
  });

  it('allows nothing at all when the variable is missing', () => {
    expect(sanityDataset(withoutProject)).toBeNull();
    expect(sanityProjectId(withoutProject)).toBeNull();
    expect(sanityImagePathPrefix(withoutProject)).toBeNull();
  });

  it.each([
    ['a wildcard', '*'],
    ['a wildcard subdomain', '*.api.sanity.io'],
    ['a whole origin', 'https://7k3m2q1p.api.sanity.io'],
    ['a host', '7k3m2q1p.api.sanity.io'],
    ['a path', '7k3m2q1p/production'],
    ['an upper-case id', '7K3M2Q1P'],
    ['a leading hyphen', '-7k3m2q1p'],
    ['a trailing hyphen', '7k3m2q1p-'],
    ['a space', '7k3m 2q1p'],
  ])('fails the build on %s', (_label, value) => {
    expect(() => sanityProjectId({ [SANITY_PROJECT_ID_VAR]: value } as NodeJS.ProcessEnv)).toThrow(
      SANITY_PROJECT_ID_VAR,
    );
  });

  describe('next.config.ts names no Sanity host of its own', () => {
    /**
     * Comments are stripped first. The comment beside the directive explains
     * why there is no Sanity entry, and a sweep for the substring counts the
     * explanation as a violation - which is how this assertion failed the first
     * time it ran.
     */
    const directives = NEXT_CONFIG.replace(/^\s*\/\/.*$/gm, '');

    it('keeps every Sanity host in this module', () => {
      // next.config.ts does not import this file directly any more: the asset
      // source reaches the CSP and the optimizer through image-hosts.ts, which
      // is the point - one list feeds both.
      expect(directives).not.toMatch(/sanity\.io/);
      const imageHosts = readFileSync(join(__dirname, 'image-hosts.ts'), 'utf8');
      expect(imageHosts).toContain("from './sanity-hosts'");
      expect(NEXT_CONFIG).toContain("from './src/lib/security/image-hosts'");
    });

    /**
     * The delivery is a server-side fetch through `@sanity/client`, so no
     * browser connects to Sanity and `connect-src` names none. If
     * `<SanityLive />` or any other browser subscription is ever added, this
     * fails and the entry has to come back with it.
     */
    it('grants no browser connection to Sanity, because nothing makes one', () => {
      expect(directives).not.toMatch(/connect-src[^;]*sanity/);
      /**
       * Matched by SHAPE, not by substring. The docstring in that file explains
       * why `next-sanity` is not used, and a sweep for the name counts the
       * explanation as a violation - which is how this assertion failed the
       * first time it ran, for the fifth time in this repository. An import
       * opens its own line; a mention of one cannot.
       */
      const web = readFileSync(join(__dirname, '../cms/client.ts'), 'utf8');
      expect(web).toMatch(/^import .* from '@sanity\/client';$/m);
      expect(web).not.toMatch(/^import .* from 'next-sanity/m);
    });
  });
});
