// Extends Jest's expect() with DOM matchers:
// toBeInTheDocument(), toHaveClass(), toBeVisible(), toHaveTextContent(), etc.
import '@testing-library/jest-dom';

// The MSW server in ./mocks/server is deliberately NOT started here.
//
// This file was wired up with `setupFilesAfterFramework`, which is not a Jest
// option, so it had never actually loaded. Correcting the key to
// setupFilesAfterEnv revealed that starting MSW from here fails: msw v2 ships
// ESM that the Next/SWC transform does not process, and it brought the whole
// suite down before a single test ran.
//
// No test uses MSW today. Rather than carry transformIgnorePatterns for a
// dependency nothing exercises, the bootstrap is left to the first test that
// actually needs it:
//
//   import { server } from '@/mocks/server';
//   beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
//   afterEach(() => server.resetHandlers());
//   afterAll(() => server.close());
//
// That test will also need the transform sorted, which is the right moment to
// pay for it.
