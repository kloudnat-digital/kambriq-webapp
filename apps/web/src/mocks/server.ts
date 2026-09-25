import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * Mock Service Worker (MSW) server configuration for Node.js test environments.
 * Allows global interception of API requests and per-test handler overrides via `server.use()`.
 */
export const server = setupServer(...handlers);
