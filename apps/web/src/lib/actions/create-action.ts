import { logger } from '@/lib/logger';
import { type TServerActionResponse } from './unwrap';

export { unwrap } from './unwrap';
export type { TServerActionResponse } from './unwrap';

const isNextRedirect = (error: unknown): boolean =>
  error instanceof Error &&
  'digest' in error &&
  typeof (error as { digest: unknown }).digest === 'string' &&
  (error as { digest: string }).digest.startsWith('NEXT_REDIRECT');

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
      if (isNextRedirect(error)) throw error;

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
