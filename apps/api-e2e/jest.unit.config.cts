/**
 * The unit half of `api-e2e`, and the reason it is a separate config.
 *
 * `jest.config.cts` runs the delivery journeys against a DEPLOYED environment
 * and loads a `globalSetup` that names it. The helpers in
 * `src/journeys/support.ts` have behaviour of their own - notably A36's wait on
 * a 429 - and that behaviour has to be provable without a deployment.
 *
 * So: no `globalSetup`, no `globalTeardown`, and `testMatch` confined to
 * `src/unit/`. The journeys config ignores that directory, so no file is run by
 * both. This config is what the `test` target points at, which is what puts
 * these tests in `Quality` on every pull request.
 *
 * `module.exports` rather than `export default`, matching
 * `apps/api/jest.config.cts`: node cannot load an ES module from a `.cts` file
 * and warns about it on every run of the sibling config that does.
 */
module.exports = {
  displayName: 'api-e2e-unit',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/unit/**/*.spec.ts'],
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/api-e2e-unit',
};
