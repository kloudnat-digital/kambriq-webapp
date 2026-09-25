jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }));

import { logger } from '@/lib/logger';
import { createAction, ServerActionError } from './create-action';

/**
 * The boundary between "the framework is telling us what to do" and "something
 * went wrong".
 *
 * Next signals redirects, `notFound()` and a bail-out to dynamic rendering by
 * THROWING, with the reason in `error.digest`. A wrapper that cannot tell those
 * from a genuine failure logs them at `error`, and this one did: a production
 * build printed sixteen `UnhandledServerActionError` lines for routes that were
 * doing exactly the right thing. The cost is not the noise - it is that a real
 * unhandled error then looks identical to normal operation.
 */
const withDigest = (digest: string): Error => Object.assign(new Error('thrown'), { digest });

const errorLog = logger.error as jest.Mock;

beforeEach(() => errorLog.mockClear());

describe('the server action boundary', () => {
  it('returns the value on success', async () => {
    const action = createAction(async () => 42);
    await expect(action()).resolves.toEqual({ success: true, data: 42 });
    expect(errorLog).not.toHaveBeenCalled();
  });

  it.each([
    ['a redirect', 'NEXT_REDIRECT;replace;/fr/login;307;'],
    ['notFound(), forbidden() and unauthorized()', 'NEXT_HTTP_ERROR_FALLBACK;404'],
    ['a bail-out to dynamic rendering', 'DYNAMIC_SERVER_USAGE'],
  ])('rethrows %s without logging it as a failure', async (_label, digest) => {
    const thrown = withDigest(digest);
    const action = createAction(async () => {
      throw thrown;
    });

    await expect(action()).rejects.toBe(thrown);
    // The whole point. Rethrowing it and ALSO logging it at error would keep
    // the behaviour correct and the log a liar.
    expect(errorLog).not.toHaveBeenCalled();
  });

  it('turns a ServerActionError into a value the caller can read', async () => {
    const action = createAction(async () => {
      throw new ServerActionError('refused', 409);
    });

    await expect(action()).resolves.toEqual({ success: false, error: 'refused', status: 409 });
    expect(errorLog).toHaveBeenCalledWith('ServerActionError', {
      message: 'refused',
      status: 409,
    });
  });

  it('still logs and rethrows a genuine failure', async () => {
    // The assertion that stops the fix above from swallowing everything. A
    // boundary that never reports anything is the defect in the other
    // direction, and it is the one nobody notices.
    const thrown = new Error('the database went away');
    const action = createAction(async () => {
      throw thrown;
    });

    await expect(action()).rejects.toBe(thrown);
    expect(errorLog).toHaveBeenCalledWith('UnhandledServerActionError', {
      error: 'the database went away',
    });
  });

  it('does not mistake an ordinary error that happens to carry a digest', async () => {
    // `digest` is not Next's alone - an application error may carry one. Only
    // the codes Next actually uses are control flow.
    const thrown = withDigest('SOMETHING_ELSE');
    const action = createAction(async () => {
      throw thrown;
    });

    await expect(action()).rejects.toBe(thrown);
    expect(errorLog).toHaveBeenCalledWith('UnhandledServerActionError', { error: 'thrown' });
  });
});
