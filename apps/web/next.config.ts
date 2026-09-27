import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';
import createNextIntlPlugin from 'next-intl/plugin';
import { robotsHeaders } from './src/lib/seo/robots';
import { imageRemotePatterns, imgSrcSources } from './src/lib/security/image-hosts';
import { frameAncestors } from './src/lib/security/studio-origin';
import { sanityDataset } from './src/lib/security/sanity-hosts';

// next-intl plugin - path is relative.
// - When NX's project-graph plugin analyses this file (CWD = workspace root),
//   it resolves to {workspace_root}/src/i18n/request.ts (a stub that satisfies the check).
// - When Next.js actually runs (CWD = apps/web/), it resolves to
//   apps/web/src/i18n/request.ts (the real implementation).
// Absolute paths are intentionally avoided: Turbopack rejects them.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * The CMS variables, read for their validation.
 *
 * `NEXT_PUBLIC_SANITY_DATASET` is used at runtime by `lib/cms/client.ts` and
 * nothing here needs its value - but a standalone build freezes what it reads,
 * and a project configured without a dataset would otherwise surface as a 500 on
 * the first page somebody opened. Failing here names the variable instead.
 */
sanityDataset(process.env);

const nextConfig: WithNxOptions = {
  // NX-specific options - controls monorepo build behaviour
  nx: {},

  // Pages are TypeScript. Long-form content comes from the CMS, so `md` and
  // `mdx` were removed with `apps/web/src/content` - leaving them would let a
  // stray markdown file become a route.
  pageExtensions: ['ts', 'tsx', 'js', 'jsx'],

  // Required for Docker standalone output (copies only the files needed to run)
  output: 'standalone',

  // Turbopack is the default bundler in Next.js 16 (was experimental.turbopack in v15)
  turbopack: {},

  // Enables additional React runtime warnings (renders twice in dev to detect side-effects)
  reactStrictMode: true,

  // React Compiler (auto-memoisation) - disabled for now, enable when ready
  reactCompiler: false,

  // Security headers applied to every response
  //
  // P4 joins this block rather than adding a second mechanism beside it. This
  // is already the only place the app sets response headers, it already matches
  // every path, and - measured - it already applies to 404 responses, which is
  // exactly where a noindex header has to reach.
  //
  // The proxy could not do the same job. Its matcher is a positive list, so it
  // never sees a URL the site does not serve - and a 404 is exactly where the
  // header matters most, because a 404 is what a crawler finds when it follows
  // a stale link.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // A23. HSTS: once a browser has seen this it refuses plain HTTP to the
          // domain for two years. Safe on dev, which is HTTPS behind the ALB.
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          // A23. An enforced Content-Security-Policy. Readable rather than maximal:
          // script-src keeps 'unsafe-inline' because Next's App Router injects inline
          // bootstrap scripts; a nonce policy needs middleware that can break RSC
          // streaming - a separate hardening. blob: is for Mapbox GL's worker.
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              // `'none'` unless SANITY_STUDIO_ORIGIN names a literal Studio
              // origin, which Sanity's Presentation tool needs in order to frame
              // this site. A wildcard is refused: see src/lib/security/studio-origin.ts.
              frameAncestors(process.env),
              "form-action 'self'",
              "script-src 'self' 'unsafe-inline' blob:",
              "style-src 'self' 'unsafe-inline'",
              // A40. The image hosts are the optimizer's own list, so the two
              // cannot drift apart. The Mapbox sources are the map widget's
              // tiles, loaded by the browser and never by the optimizer.
              `img-src 'self' data: blob: ${imgSrcSources(process.env).join(' ')} https://api.mapbox.com https://*.tiles.mapbox.com`,
              "font-src 'self' data:",
              "worker-src 'self' blob:",
              // No Sanity entry: CMS documents are fetched by the Next server,
              // so nothing in the browser connects to Sanity. A source listed
              // for a connection nothing makes is a permission granted for
              // nothing.
              "connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com",
            ].join('; '),
          },
          // Empty in production, `noindex, nofollow` everywhere else. Reads
          // APP_ENV, never NODE_ENV - the runtime image sets NODE_ENV=production
          // on dev too, so NODE_ENV cannot tell the two apart. See src/lib/seo/robots.ts.
          ...robotsHeaders(),
        ],
      },
    ];
  },

  // Next.js image optimisation for the hosts named in
  // src/lib/security/image-hosts.ts, and no others (A40). The optimizer is
  // anonymous and decodes what it fetches, so a wildcard host lets whoever owns
  // a name under it choose those bytes. The media bucket comes from
  // MEDIA_BUCKET_HOST at build time; without it, bucket URLs are refused.
  //
  // `unoptimized` stays as it is: the runtime image sets NODE_ENV=production on
  // every environment, so optimisation is on for dev and prd alike.
  images: {
    remotePatterns: imageRemotePatterns(process.env),
    unoptimized: process.env.NODE_ENV !== 'production',
  },
};

const plugins = [
  // withNextIntl must come before withNx so Next.js picks up the plugin hooks first
  withNextIntl,
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
