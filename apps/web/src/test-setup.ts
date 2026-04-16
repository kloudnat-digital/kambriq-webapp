// Extends Jest's expect() with DOM matchers:
// toBeInTheDocument(), toHaveClass(), toBeVisible(), toHaveTextContent(), etc.
import '@testing-library/jest-dom';

// Start the MSW server before all tests, reset handlers after each test,
// and close the server after all tests complete.
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
