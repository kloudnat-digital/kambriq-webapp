/**
 * @jest-environment node
 *
 * A header assembled from an environment variable, and nothing here touches the
 * DOM. Under jsdom this file would still run, but `image-hosts.spec.ts` beside
 * it does not - so the environment is stated rather than inherited.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { frameAncestors, STUDIO_ORIGIN_VAR, studioOrigin } from './studio-origin';

/**
 * `frame-ancestors` decides who may put this site inside an iframe, which is
 * the whole of its clickjacking protection. Sanity's Presentation tool needs
 * the Studio's origin allowed; nothing else does.
 */
const env = (value?: string): NodeJS.ProcessEnv =>
  (value === undefined ? {} : { [STUDIO_ORIGIN_VAR]: value }) as NodeJS.ProcessEnv;

describe('the frame-ancestors directive', () => {
  it("is 'none' when nothing is configured", () => {
    // The default has a direction. Presentation is not in use, so the header is
    // not weakened for it: setting the variable is what opens the door.
    expect(frameAncestors(env())).toBe("frame-ancestors 'none'");
    expect(frameAncestors(env(''))).toBe("frame-ancestors 'none'");
    expect(frameAncestors(env('   '))).toBe("frame-ancestors 'none'");
  });

  it('names exactly the configured Studio origin, and nothing else', () => {
    expect(frameAncestors(env('https://kambriq.sanity.studio'))).toBe(
      'frame-ancestors https://kambriq.sanity.studio',
    );
  });

  it("does not add 'self'", () => {
    // Nothing on this origin frames its own pages. A source nothing uses is how
    // an allowlist becomes a list of things somebody once thought might help.
    expect(frameAncestors(env('https://kambriq.sanity.studio'))).not.toContain("'self'");
  });

  it('refuses a wildcard, which is the reason this file exists', () => {
    /**
     * `https://*.sanity.studio` appears in several published guides. Anybody
     * can create a Sanity project and be given a subdomain there, so that
     * directive lets any Sanity customer's Studio frame this site - `A40`'s
     * `**.amazonaws.com`, one CSP directive over.
     */
    for (const wildcard of [
      'https://*.sanity.studio',
      'https://*.sanity.io',
      '*',
      "'*'",
      'https://kambriq.*.studio',
    ]) {
      expect(() => studioOrigin(env(wildcard))).toThrow(STUDIO_ORIGIN_VAR);
    }
  });

  it('refuses anything that is not a literal Studio origin', () => {
    for (const bad of [
      'kambriq.sanity.studio', // no scheme
      'http://kambriq.sanity.studio', // not https
      'https://kambriq.sanity.studio/desk', // a path
      'https://kambriq.example.com', // another host entirely
      'https://sanity.studio', // the bare apex, not a project
    ]) {
      expect(() => studioOrigin(env(bad))).toThrow(STUDIO_ORIGIN_VAR);
    }
  });

  it('is the only place the directive is written', () => {
    /**
     * The same rule `image-hosts.spec.ts` holds for image hosts: a value
     * hardcoded into `next.config.ts` would be invisible to every check here.
     */
    const config = readFileSync(join(__dirname, '..', '..', '..', 'next.config.ts'), 'utf8');

    expect(config).toContain('frameAncestors(process.env)');
    // The literal directive must not be typed into the config beside the call.
    expect(config).not.toMatch(/["'`]frame-ancestors[^"'`]*["'`]/);
    expect(config).not.toContain('sanity.studio');
  });
});
