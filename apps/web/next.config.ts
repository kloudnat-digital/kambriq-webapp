import { composePlugins, withNx } from '@nx/next';
import type { WithNxOptions } from '@nx/next/plugins/with-nx';
import createNextIntlPlugin from 'next-intl/plugin';

// next-intl plugin - path is relative.
// - When NX's project-graph plugin analyses this file (CWD = workspace root),
//   it resolves to {workspace_root}/src/i18n/request.ts (a stub that satisfies the check).
// - When Next.js actually runs (CWD = apps/web/), it resolves to
//   apps/web/src/i18n/request.ts (the real implementation).
// Absolute paths are intentionally avoided: Turbopack rejects them.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: WithNxOptions = {
  // NX-specific options - controls monorepo build behaviour
  nx: {},

  // Required for Docker standalone output (copies only the files needed to run)
  output: 'standalone',

  // Turbopack is the default bundler in Next.js 16 (was experimental.turbopack in v15)
  turbopack: {},

  // React Compiler (auto-memoisation) - disabled for now, enable when ready
  reactCompiler: false,

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
  withNx,
];

export default composePlugins(...plugins)(nextConfig);
