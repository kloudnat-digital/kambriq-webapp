module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/api',
  coverageReporters: ['lcov', 'text-summary'],
  // Measure every source file, not only the ones a test happens to import.
  // Without this, a module with no tests at all simply disappears from the
  // denominator instead of lowering the percentage.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/__test__/**',
    // Wiring and bootstrap, no behaviour of their own.
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.d.ts',
  ],
};
