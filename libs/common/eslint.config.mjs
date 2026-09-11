import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],

          /**
           * `@prisma/client` is declared in this library's `package.json` and the
           * rule cannot see why. **Do not delete it from either place.**
           *
           * The four generated Prisma clients live under `libs/common/src/prisma/`,
           * which `.gitignore` excludes. Nx builds its project graph from the files
           * `.gitignore` does not exclude, so those files do not exist as far as
           * this rule is concerned - and **57 of them import `@prisma/client`**.
           * The rule therefore reports the dependency as unused. That verdict is
           * about visibility, not about usage.
           *
           * The dependency is real, and at runtime rather than only in types: two
           * of those files reach for the Postgres query compiler through a dynamic
           * `import('@prisma/client/runtime/query_compiler_fast_bg.postgresql.js')`.
           * Remove the declaration and the rule goes quiet while the library loses
           * a package it actually loads.
           *
           * Proved rather than reasoned: adding one **non-ignored** file under
           * `libs/common/src` that imports the same runtime subpath makes this
           * error disappear, and deleting that file brings it back. The blindness
           * is the ignore rule, nothing else.
           *
           * This is the only entry here, and it should stay that way. A second one
           * added without its own reason is how a check stops meaning anything -
           * and note the direction that is *not* covered: a package the generated
           * code imports and the manifest does **not** declare is invisible to this
           * rule too, and it fails at runtime rather than in CI. That list was
           * enumerated when this exception was written and held only
           * `@prisma/client` and three Node builtins. Re-enumerate it if the
           * generator is ever upgraded.
           */
          ignoredDependencies: ['@prisma/client'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
];
