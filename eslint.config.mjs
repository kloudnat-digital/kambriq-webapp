import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    /**
     * No `console.log` in shipped code.
     *
     * In a server component it writes its argument to the container's stdout;
     * in a client component, to the user's browser console. Either way it is
     * uncontrolled disclosure of whatever was logged.
     *
     * `warn` and `error` remain allowed:
     * `libs/common/src/config/env.validation.ts` prints a startup banner
     * before any logger exists, and `apps/web` has no logger, so
     * `console.error` is its only channel there.
     */
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    /**
     * Tests and test tooling are exempt: their stdout is their output.
     *
     * `middleware-matcher.spec.ts` prints the route table, the database global
     * setup prints the database each module migrated against, and the delivery
     * journeys print one line per throttle wait.
     *
     * The globs match shapes rather than paths. Each nx project has its own
     * `eslint.config.mjs` spreading this one, and flat config resolves `files`
     * against the directory eslint runs in, so a path-anchored
     * `apps/api-e2e/**` would match nothing.
     */
    files: [
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.dbspec.ts',
      '**/__test__/**',
      '**/global-setup.ts',
      '**/global-teardown.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    /**
     * The root `prisma/` scripts are command-line tools: seeding, migrations,
     * the super-admin bootstrap and the KCA1 loaders. Their console output is
     * what the operator reads, and none of them runs in a container or a
     * browser.
     *
     * Path-anchored deliberately. These files belong to no nx project, so
     * `nx run-many -t lint` never reaches them and this block is only ever
     * evaluated by an eslint run from the repository root, which is what
     * `lint-staged` does.
     */
    files: ['prisma/**/*.ts', 'prisma/**/*.js'],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@kambriq/common/**/*enum*', '@kambriq/common/**/*enums*'],
              message: 'Import enums via @kambriq/common instead of directly from enum files.',
            },
          ],
        },
      ],
    },
  },
];
