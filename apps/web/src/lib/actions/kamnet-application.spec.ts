jest.mock('@/lib/api/server', () => {
  class ApiError extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return { ApiError, api: {}, serverApi: { get: jest.fn(), post: jest.fn() } };
});
jest.mock('./revalidate', () => ({ revalidateLocalisedPath: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { ApiError, serverApi } from '@/lib/api/server';
import { getMyApplicationStanding, submitKamnetApplication } from './kamnet';

const get = serverApi.get as jest.Mock;
const post = serverApi.post as jest.Mock;

/**
 * P5 - the actions behind `/kamnet/apply`, tested on their own, because the
 * page tests mock them (the L1 lesson: a mocked collaborator needs its own
 * tests, or the boundary is covered from neither side).
 */
describe('P5 - where the applicant stands', () => {
  beforeEach(() => jest.resetAllMocks());

  it.each([404, 403])('a %i on the certificate is "not certified"', async (status) => {
    get.mockRejectedValueOnce(new ApiError('no', status));
    expect(await getMyApplicationStanding()).toEqual({
      success: true,
      data: { state: 'not-certified' },
    });
  });

  it('any other failure is "unavailable", never "not certified"', async () => {
    get.mockRejectedValueOnce(new ApiError('down', 503));
    expect(await getMyApplicationStanding()).toEqual({
      success: true,
      data: { state: 'unavailable' },
    });
  });

  it('a certificate and no application is "can apply", with the certificate number', async () => {
    get
      .mockResolvedValueOnce({ kcaNumber: 'KCA-1' })
      .mockRejectedValueOnce(new ApiError('none', 404));
    expect(await getMyApplicationStanding()).toEqual({
      success: true,
      data: { state: 'can-apply', kcaNumber: 'KCA-1' },
    });
  });

  it('an existing application is returned as it is', async () => {
    const application = { id: 'a1', status: 'PENDING' };
    get.mockResolvedValueOnce({ kcaNumber: 'KCA-1' }).mockResolvedValueOnce(application);
    expect(await getMyApplicationStanding()).toEqual({
      success: true,
      data: { state: 'applied', application },
    });
  });
});

describe('P5 - submitting an application', () => {
  beforeEach(() => jest.resetAllMocks());

  it('sends the KCA number read from the certificate, never one from the browser', async () => {
    get.mockResolvedValueOnce({ kcaNumber: 'KCA-OWN' });
    post.mockResolvedValueOnce({ id: 'a1', status: 'PENDING' });
    const result = await submitKamnetApplication({
      sponsorCode: '  ',
      motivation: '  Une motivation.  ',
      kcaNumber: 'KCA-SOMEONE-ELSE',
    } as never);
    expect(post).toHaveBeenCalledWith('/kamnet/applications', {
      kcaNumber: 'KCA-OWN',
      sponsorCode: undefined,
      motivation: 'Une motivation.',
    });
    expect(result).toMatchObject({ success: true });
  });

  it('reports a refusal from the API as a failure, never as a submission', async () => {
    get.mockResolvedValueOnce({ kcaNumber: 'KCA-OWN' });
    post.mockRejectedValueOnce(new ApiError('Parrain introuvable', 404));
    expect(await submitKamnetApplication({ motivation: 'x' })).toMatchObject({
      success: false,
      error: 'Parrain introuvable',
    });
  });
});
