module.exports = {
  displayName: 'api',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // These packages are ESM-only, and Jest's CJS runtime does not use Node's
  // require(esm). The list is the dependency CHAIN, not the packages imported:
  // `@portabletext/to-html` imports toolkit, which imports types, and `groq-js`
  // imports `obug`. Each one surfaces only once the one above it is
  // transformed, so a short list fails naming the next package.
  //
  // The lookahead spans the whole remaining path rather than the next segment.
  // A pnpm path is `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>`, so a
  // pattern that only looked ahead one segment would match at the first
  // `node_modules/` and ignore the file after all.
  transformIgnorePatterns: ['node_modules/(?!.*(?:@portabletext|groq-js|obug))'],
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
