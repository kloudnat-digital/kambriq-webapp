const nextJest = require('next/jest.js');

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  displayName: 'web',
  preset: '../../jest.preset.js',
  transform: {
    '^(?!.*\\.(js|jsx|ts|tsx|css|json)$)': '@nx/react/plugins/jest',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  coverageDirectory: '../../coverage/apps/web',
  // Match apps/api and libs/common so Codecov receives the same shape.
  // Without lcov here the web project produced only an HTML report, which
  // nothing consumes.
  coverageReporters: ['lcov', 'text-summary'],
  testEnvironment: 'jsdom',
  // Runs before every test file - imports jest-dom custom matchers.
  // The key is setupFilesAfterEnv; setupFilesAfterFramework is not a Jest
  // option, so this setup file was silently never loaded.
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  // Where to find tests - both in src/ and the NX-generated specs/ folder
  testMatch: [
    '<rootDir>/src/**/*.spec.{ts,tsx}',
    '<rootDir>/src/**/*.test.{ts,tsx}',
    '<rootDir>/specs/**/*.spec.{ts,tsx}',
  ],
  // Coverage collection
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/test-setup.ts',
  ],
};

/**
 * `next-intl` and its `use-intl` core are published as ESM only, so Jest has to
 * transform them. `next/jest` ignores all of `node_modules` by default, which
 * leaves `SyntaxError: Unexpected token 'export'` on the first import.
 *
 * next-intl documents `node_modules/(?!next-intl)/`, and that pattern does not
 * work under pnpm. A real path here is
 * `node_modules/.pnpm/next-intl@4.8.3_.../node_modules/next-intl/dist/...`, and
 * the pattern is unanchored, so it matches at the FIRST `node_modules/` - the
 * one followed by `.pnpm` - and the file is ignored after all. The failure is
 * silent in the sense that it looks like a next-intl bug rather than a config
 * one.
 *
 * This form asks whether the whole remaining path mentions one of the named
 * packages, so it answers the same at every `node_modules/` in it.
 *
 * The list is the ESM dependency chain rather than next-intl alone, because
 * each one surfaces only after the one above it is transformed: next-intl ->
 * use-intl -> intl-messageformat -> @formatjs/*, plus @formatjs/intl-localematcher
 * and icu-minify. A shorter list fails with the next package's name, which
 * reads like that package being broken.
 *
 * The CSS-module entry is `next/jest`'s own default and is kept: replacing the
 * array wholesale drops it.
 */
module.exports = async () => ({
  ...(await createJestConfig(config)()),
  transformIgnorePatterns: [
    'node_modules/(?!.*(?:next-intl|use-intl|@formatjs|intl-messageformat|icu-minify|@schummar))',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
});
