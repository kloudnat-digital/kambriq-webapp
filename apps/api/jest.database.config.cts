/**
 * The database-backed suite.
 *
 * A separate configuration from `jest.config.cts`, and a separate file suffix
 * (`*.dbspec.ts`), so that `nx test api` stays what it is: suites that open no
 * connection and run anywhere. This one needs a Postgres and is run as
 * `pnpm test:db`.
 *
 * `runInBand` because every test shares one database and one migration history;
 * two workers racing `migrate deploy` would be a test of the race.
 */
module.exports = {
  displayName: 'api-db',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.dbspec.ts'],
  globalSetup: '<rootDir>/src/__test__/database/global-setup.ts',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Postgres is local, but a first run also applies every migration.
  testTimeout: 30_000,
};
