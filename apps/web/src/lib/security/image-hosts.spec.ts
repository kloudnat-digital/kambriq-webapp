/**
 * @jest-environment node
 *
 * A40's checks are file reads, config objects and an AWS presigned URL - not
 * one line of this touches the DOM. Under the project's default jsdom
 * environment the suite does not run at all: `@aws-sdk/client-s3` pulls in
 * `@smithy/core`, which reads `TextDecoder` at module scope, and jsdom does
 * not provide it. `ReferenceError: TextDecoder is not defined`, zero tests, and
 * a suite that reports nothing reports no defect either.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { hasRemoteMatch } from 'next/dist/shared/lib/match-remote-pattern';
import {
  imageHosts,
  imageRemotePatterns,
  imgSrcSources,
  MEDIA_BUCKET_HOST_VAR,
  mediaBucketHost,
  uploadConnectSources,
  FONT_STYLESHEET_URL,
  fontSrcSources,
  styleSrcSources,
} from './image-hosts';
import { SANITY_PROJECT_ID_VAR } from './sanity-hosts';

const DEV_BUCKET = 'kambriq-media-dev';
const DEV_REGION = 'eu-central-1';
const DEV_HOST = `${DEV_BUCKET}.s3.${DEV_REGION}.amazonaws.com`;

const SANITY_PROJECT = '7k3m2q1p';

const withBucket = { [MEDIA_BUCKET_HOST_VAR]: DEV_HOST } as NodeJS.ProcessEnv;
const withoutBucket = {} as NodeJS.ProcessEnv;
const withSanity = {
  [MEDIA_BUCKET_HOST_VAR]: DEV_HOST,
  [SANITY_PROJECT_ID_VAR]: SANITY_PROJECT,
} as NodeJS.ProcessEnv;

const NEXT_CONFIG = readFileSync(join(__dirname, '../../../next.config.ts'), 'utf8');

/**
 * The same client options and the same call as `StorageService.getDownloadUrl`
 * in libs/common, with throwaway credentials: presigning is local, so this is
 * the exact shape of URL the API hands the web for an avatar or a land photo.
 */
async function presignedMediaUrl(key: string): Promise<URL> {
  const s3 = new S3Client({
    region: DEV_REGION,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: 'AKIAEXAMPLEEXAMPLE00', secretAccessKey: 'not-a-secret' },
  });
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: DEV_BUCKET, Key: key }), {
    expiresIn: 1800,
  });
  return new URL(url);
}

const accepted = (env: NodeJS.ProcessEnv, url: URL) =>
  hasRemoteMatch([], imageRemotePatterns(env), url);

describe('image optimizer hosts', () => {
  describe.each([
    ['with the bucket variable', withBucket],
    ['without it', withoutBucket],
    ['with the bucket and a Sanity project', withSanity],
  ])('%s', (_label, env) => {
    it('lists only literal hostnames - no wildcard anywhere in the host', () => {
      for (const { hostname } of imageRemotePatterns(env)) {
        expect(hostname).not.toMatch(/\*/);
        expect(hostname).toMatch(/^[a-z0-9.-]+$/);
      }
    });

    it('names in the CSP img-src exactly what the optimizer may fetch, paths included', () => {
      // A source that carries a path must carry the same path in both, or the
      // browser and the optimizer disagree about what is allowed.
      expect(imgSrcSources(env)).toEqual(
        imageRemotePatterns(env).map((pattern) =>
          'pathname' in pattern
            ? `https://${pattern.hostname}${pattern.pathname.replace(/\*\*$/, '')}`
            : `https://${pattern.hostname}`,
        ),
      );
    });
  });

  it('refuses the bucket when the variable is missing, rather than opening up', () => {
    expect(mediaBucketHost(withoutBucket)).toBeNull();
    expect(imageHosts(withoutBucket).some((h) => h.endsWith('amazonaws.com'))).toBe(false);
  });

  it.each([
    '**.amazonaws.com',
    '*.s3.eu-central-1.amazonaws.com',
    `https://${DEV_HOST}`,
    `${DEV_HOST}/users`,
    's3.amazonaws.com',
    'kambriq-media-dev.s3.eu-central-1.amazonaws.com.evil.example',
  ])('fails the build on a value that is not a plain bucket hostname: %s', (value) => {
    expect(() => mediaBucketHost({ [MEDIA_BUCKET_HOST_VAR]: value } as NodeJS.ProcessEnv)).toThrow(
      MEDIA_BUCKET_HOST_VAR,
    );
  });

  describe("through the optimizer's own matcher", () => {
    it('still accepts a presigned avatar URL from our bucket', async () => {
      const url = await presignedMediaUrl('users/u1/avatar/1758600000000-photo.jpg');
      expect(url.hostname).toBe(DEV_HOST);
      expect(url.search).toContain('X-Amz-Signature=');
      expect(accepted(withBucket, url)).toBe(true);
    });

    it('still accepts a land photo URL from our bucket', async () => {
      expect(accepted(withBucket, await presignedMediaUrl('lands/l1/cover.jpg'))).toBe(true);
    });

    it.each([
      [
        'another bucket in the same region',
        'https://someone-else.s3.eu-central-1.amazonaws.com/x.png',
      ],
      ['the host the triage used to show the hole', 'https://s3.amazonaws.com/'],
      ['a CloudFront distribution', 'https://d1234abcd.cloudfront.net/x.png'],
      ['our own bucket on an explicit port', `https://${DEV_HOST}:8443/x.png`],
    ])('refuses %s', (_label, url) => {
      expect(accepted(withBucket, new URL(url))).toBe(false);
    });

    it('refuses our own bucket too when the variable is missing', async () => {
      expect(accepted(withoutBucket, await presignedMediaUrl('users/u1/avatar/x.jpg'))).toBe(false);
    });

    /**
     * `cdn.sanity.io` is one hostname for every Sanity customer, and anybody can
     * create a project on it. Listed as a bare host it is `**.amazonaws.com`
     * with a literal name, so the project is a path segment and the pattern
     * carries it.
     */
    describe('the Sanity asset CDN', () => {
      const asset = (path: string) => new URL(`https://cdn.sanity.io${path}`);

      it('accepts an image of our own project, with its transform query', () => {
        expect(
          accepted(
            withSanity,
            asset(`/images/${SANITY_PROJECT}/production/Ab12-300x450.jpg?w=800&auto=format`),
          ),
        ).toBe(true);
      });

      it.each([
        ["another customer's project", '/images/someoneelse/production/x.jpg'],
        ['the same host outside the image path', `/files/${SANITY_PROJECT}/production/x.pdf`],
        ['the bare host', '/'],
      ])('refuses %s', (_label, path) => {
        expect(accepted(withSanity, asset(path))).toBe(false);
      });

      it('refuses our own project when the variable is missing', () => {
        expect(
          accepted(withBucket, asset(`/images/${SANITY_PROJECT}/production/Ab12-300x450.jpg`)),
        ).toBe(false);
      });
    });
  });

  // `MEDIA_BUCKET_HOST` reaching the image is asserted with every other
  // build-time variable, in `build-vars-reach-the-image.spec.ts`.

  /**
   * A44 - the browser uploads an avatar straight to the bucket with a presigned
   * PUT. `connect-src` named Mapbox only, so on dev Chromium refused the request
   * ("violates the following Content Security Policy directive: connect-src")
   * and the upload had never worked. The bucket reaches `connect-src` from the
   * same variable as `img-src` - and only the bucket: the browser uploads
   * nowhere else, so no other image host is opened for writing.
   */
  describe('the browser may upload to the bucket, and only there', () => {
    it('names the bucket when the variable is set', () => {
      expect(uploadConnectSources(withBucket)).toEqual([`https://${DEV_HOST}`]);
    });

    it('names nothing when it is missing, rather than opening up', () => {
      expect(uploadConnectSources(withoutBucket)).toEqual([]);
    });

    it('connect-src in next.config.ts is built from it', () => {
      const connectSrc = NEXT_CONFIG.match(/[`'"]connect-src [^\n]*/)?.[0] ?? '';
      expect(connectSrc).toContain('uploadConnectSources(process.env)');
    });
  });

  /**
   * J11 - the site's typeface. The layout linked Switzer from fontshare, and
   * the CSP allowed neither the stylesheet's host (`style-src`) nor the font
   * files' host (`font-src`): on dev the browser refused the stylesheet on
   * every page and no Switzer face was ever registered, so the site has always
   * rendered in the fallback. The two hosts, and the link itself, come from
   * here - the same single source as the image hosts.
   */
  describe('the typeface: the stylesheet and its font files', () => {
    it('names the stylesheet host for style-src and the file host for font-src, and nothing else', () => {
      expect(new URL(FONT_STYLESHEET_URL).protocol).toBe('https:');
      expect(styleSrcSources()).toEqual([`https://${new URL(FONT_STYLESHEET_URL).host}`]);
      expect(fontSrcSources()).toEqual(['https://cdn.fontshare.com']);
    });

    it('the layout links the stylesheet from here, and names no font host itself', () => {
      const layout = readFileSync(join(__dirname, '../../app/[locale]/layout.tsx'), 'utf8');
      expect(layout).toMatch(/href=\{FONT_STYLESHEET_URL\}/);
      expect(layout).not.toMatch(/fontshare\.com/);
    });

    it('style-src and font-src in next.config.ts are built from it', () => {
      const directive = (name: string) =>
        NEXT_CONFIG.match(new RegExp(`[\`'"]${name} [^\\n]*`))?.[0] ?? '';
      expect(directive('style-src')).toContain('styleSrcSources()');
      expect(directive('font-src')).toContain('fontSrcSources()');
      expect(NEXT_CONFIG).not.toMatch(/fontshare\.com/);
    });
  });

  describe('next.config.ts takes its hosts from here and nowhere else', () => {
    it('declares no hostname of its own', () => {
      expect(NEXT_CONFIG).not.toMatch(/hostname\s*:/);
    });

    it('names no S3 or CloudFront host anywhere, not even in a header', () => {
      expect(NEXT_CONFIG).not.toMatch(/amazonaws\.com|cloudfront\.net/);
    });

    it('takes remotePatterns from the module', () => {
      expect(NEXT_CONFIG).toMatch(/remotePatterns:\s*imageRemotePatterns\(process\.env\)/);
    });

    /**
     * One wildcard is allowed, by name: the Mapbox tile servers, which the
     * browser's map widget loads directly and the optimizer never fetches.
     */
    it('builds img-src from the same list, with no other wildcard source', () => {
      const imgSrc = NEXT_CONFIG.match(/[`'"]img-src [^\n]*/)?.[0] ?? '';
      expect(imgSrc).toContain('imgSrcSources(process.env)');
      expect(imgSrc.replace('https://*.tiles.mapbox.com', '')).not.toMatch(/\*/);
    });
  });
});
