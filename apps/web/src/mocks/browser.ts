import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * Mock Service Worker (MSW) setup for browser environments.
 * Intercepts outgoing client-side requests for local development without a backend.
 */
export const worker = setupWorker(...handlers);
