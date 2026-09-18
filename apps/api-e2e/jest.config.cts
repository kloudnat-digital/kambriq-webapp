export default {
  displayName: 'api-e2e',
  preset: '../../jest.preset.js',
  globalSetup: '<rootDir>/src/support/global-setup.ts',
  globalTeardown: '<rootDir>/src/support/global-teardown.ts',
  testEnvironment: 'node',
  testTimeout: 300000,
  // `src/unit/` is the unit half of this project and runs under
  // `jest.unit.config.cts`, which loads no `globalSetup`. Ignored here so no
  // file is executed by both configs, and so the journeys' suite and test
  // counts keep meaning what they have always meant.
  testPathIgnorePatterns: ['<rootDir>/src/unit/'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/api-e2e',
};
