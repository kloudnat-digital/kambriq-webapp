import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW server for Jest (Node.js environment).
 *
 * Usage in tests:
 *   import { server } from '@/mocks/server';
 *
 *   beforeAll(() => server.listen());
 *   afterEach(() => server.resetHandlers()); // clear per-test overrides
 *   afterAll(() => server.close());
 *
 * To override a handler for a single test:
 *   server.use(http.get('/api/v1/lands', () => HttpResponse.json([])));
 */
export const server = setupServer(...handlers);
