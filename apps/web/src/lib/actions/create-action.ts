import { logger } from '@/lib/logger';
import { type TServerActionResponse } from './unwrap';

export { unwrap } from './unwrap';
export type { TServerActionResponse } from './unwrap';

/**
 * The digests Next uses to signal control flow through a thrown error.
 *
 * Read from the shipped package rather than remembered:
 * `client/components/redirect-error` (`NEXT_REDIRECT`),
 * `client/components/http-access-fallback/http-access-fallback`
 * (`NEXT_HTTP_ERROR_FALLBACK`, which carries `notFound`, `forbidden` and
 * `unauthorized`) and `client/components/hooks-server-context`
 * (`DYNAMIC_SERVER_USAGE`, thrown when a statically rendered route reads
 * `headers()` or `cookies()` and has to fall back to dynamic rendering).
 *
 * They are matched on the digest string rather than through Next's own
 * predicates, which live under `next/dist/...` and are not part of its public
 * surface.
 */
const NEXT_CONTROL_FLOW_DIGESTS = [
  'NEXT_REDIRECT',
  'NEXT_HTTP_ERROR_FALLBACK',
  'DYNAMIC_SERVER_USAGE',
];

/**
 * Whether an error is Next telling the framework what to do next.
 *
 * None of these is a failure, and logging them as one costs twice: the build
 * printed sixteen `UnhandledServerActionError` lines for routes that were
 * correctly falling back to dynamic rendering, and a real unhandled error is
 * indistinguishable from them in the same log.
 *
 * This checked `NEXT_REDIRECT` alone, which was right when `redirect()` was
 * the only one of the three that reached a server action.
 */
const isNextControlFlow = (error: unknown): boolean => {
  if (!(error instanceof Error) || !('digest' in error)) return false;
  const { digest } = error as { digest: unknown };
  return (
    typeof digest === 'string' && NEXT_CONTROL_FLOW_DIGESTS.some((code) => digest.startsWith(code))
  );
};

export class ServerActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ServerActionError';
    this.status = status;
  }
}

export const createAction =
  <Return = undefined, Args extends unknown[] = []>(fn: (...args: Args) => Promise<Return>) =>
  async (...args: Args): Promise<TServerActionResponse<Return>> => {
    try {
      const data = await fn(...args);
      return { success: true, data } as TServerActionResponse<Return>;
    } catch (error) {
      if (isNextControlFlow(error)) throw error;

      if (error instanceof ServerActionError) {
        logger.error('ServerActionError', { message: error.message, status: error.status });
        return { success: false, error: error.message, status: error.status };
      }

      logger.error('UnhandledServerActionError', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
