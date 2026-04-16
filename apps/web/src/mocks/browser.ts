import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/**
 * MSW browser worker - for intercepting requests in the browser.
 * Used during local development when you want to mock APIs without a backend.
 *
 * To enable: call worker.start() in your app entry point (e.g. layout.tsx)
 * and add the service worker file to /public:
 *   npx msw init public/
 */
export const worker = setupWorker(...handlers);
