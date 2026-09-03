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

module.exports = createJestConfig(config);
