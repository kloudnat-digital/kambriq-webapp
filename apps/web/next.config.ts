import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';
import createNextIntlPlugin from 'next-intl/plugin';
import createMDX from '@next/mdx';

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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Allow Next.js image optimisation for external domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
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
