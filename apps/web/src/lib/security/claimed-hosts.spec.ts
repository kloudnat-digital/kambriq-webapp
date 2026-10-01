/**
 * @jest-environment node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CLAIMED_MEDIA_BUCKET_HOSTS,
  CLAIMED_SANITY_PROJECT_IDS,
  CLAIMED_STUDIO_ORIGINS,
  assertSecurityHostsClaimed,
} from './claimed-hosts';
import { frameAncestors } from './studio-origin';

const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;

describe('C44 - a security-header host must be one we have proven we hold', () => {
  it('refuses the Studio origin that belonged to another organisation', () => {
    const foreign = env({ SANITY_STUDIO_ORIGIN: 'https://kambriq.sanity.studio' });
    // The shape check alone accepts it: that is the hole this guard closes.
    expect(frameAncestors(foreign)).toBe('frame-ancestors https://kambriq.sanity.studio');
    expect(() => assertSecurityHostsClaimed(foreign)).toThrow(
      /SANITY_STUDIO_ORIGIN=https:\/\/kambriq\.sanity\.studio names a host this platform has not proven it holds/,
    );
  });

  it('accepts the Studio origin the deploy claimed', () => {
    expect(() =>
      assertSecurityHostsClaimed(
        env({ SANITY_STUDIO_ORIGIN: 'https://kambriq-studio.sanity.studio' }),
      ),
    ).not.toThrow();
  });

  it('refuses a well-formed bucket that is not ours, and accepts ours', () => {
    expect(() =>
      assertSecurityHostsClaimed(
        env({ MEDIA_BUCKET_HOST: 'someone-else.s3.eu-central-1.amazonaws.com' }),
      ),
    ).toThrow(/MEDIA_BUCKET_HOST=someone-else/);
    expect(() =>
      assertSecurityHostsClaimed(
        env({ MEDIA_BUCKET_HOST: 'kambriq-media-dev.s3.eu-central-1.amazonaws.com' }),
      ),
    ).not.toThrow();
  });

  it('refuses a well-formed Sanity project that is not ours, and accepts ours', () => {
    expect(() =>
      assertSecurityHostsClaimed(
        env({
          NEXT_PUBLIC_SANITY_PROJECT_ID: '7k3m2q1p',
          NEXT_PUBLIC_SANITY_DATASET: 'production',
        }),
      ),
    ).toThrow(/NEXT_PUBLIC_SANITY_PROJECT_ID=7k3m2q1p/);
    expect(() =>
      assertSecurityHostsClaimed(
        env({
          NEXT_PUBLIC_SANITY_PROJECT_ID: '4c3y0546',
          NEXT_PUBLIC_SANITY_DATASET: 'production',
        }),
      ),
    ).not.toThrow();
  });

  it('asks nothing of a variable that is not set', () => {
    expect(() => assertSecurityHostsClaimed(env({}))).not.toThrow();
  });

  it('lists nothing without a proof that names when and how it was claimed', () => {
    for (const claim of [
      ...CLAIMED_STUDIO_ORIGINS,
      ...CLAIMED_MEDIA_BUCKET_HOSTS,
      ...CLAIMED_SANITY_PROJECT_IDS,
    ]) {
      expect({ value: claim.value, proof: claim.proof }).toEqual({
        value: claim.value,
        proof: expect.stringMatching(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?Z/),
      });
    }
  });

  it('runs where the headers are frozen: next.config.ts calls it on the build environment', () => {
    const config = readFileSync(join(__dirname, '../../../next.config.ts'), 'utf8');
    expect(config).toMatch(/^assertSecurityHostsClaimed\(process\.env\);$/m);
  });
});
