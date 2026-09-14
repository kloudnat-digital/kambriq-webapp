import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';
import createNextIntlPlugin from 'next-intl/plugin';
import createMDX from '@next/mdx';
import { robotsHeaders } from './src/lib/seo/robots';

// next-intl plugin - path is relative.
// - When NX's project-graph plugin analyses this file (CWD = workspace root),
//   it resolves to {workspace_root}/src/i18n/request.ts (a stub that satisfies the check).
// - When Next.js actually runs (CWD = apps/web/), it resolves to
//   apps/web/src/i18n/request.ts (the real implementation).
// Absolute paths are intentionally avoided: Turbopack rejects them.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// MDX plugin - enables .mdx files as React components throughout the app.
// Note: remark/rehype plugins with function values are not supported by Turbopack
// (options must be serializable). Add plugins only when switching to webpack builds.
const withMDX = createMDX({});

const nextConfig: WithNxOptions = {
  // NX-specific options - controls monorepo build behaviour
  nx: {},

  // Tell Next.js to treat .md and .mdx files as pages/components
  pageExtensions: ['ts', 'tsx', 'js', 'jsx', 'md', 'mdx'],

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
  // exactly where a noindex header has to reach. A middleware header could not
  // have done the same job after P3: the matcher now runs on protected prefixes
  // only, so it never sees the public pages that most need the header.
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
              "frame-ancestors 'none'",
              "form-action 'self'",
              "script-src 'self' 'unsafe-inline' blob:",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudfront.net https://images.unsplash.com https://api.mapbox.com https://*.tiles.mapbox.com",
              "font-src 'self' data:",
              "worker-src 'self' blob:",
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

  // Allow Next.js image optimisation for external domains
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      // S3 buckets - update with the actual bucket hostname when configured
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.cloudfront.net' },
    ],
    unoptimized: process.env.NODE_ENV !== 'production',
  },
};

const plugins = [
  // withNextIntl must come before withNx so Next.js picks up the plugin hooks first
  withNextIntl,
  // withMDX compiles .mdx files; must come before withNx
  withMDX,
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
