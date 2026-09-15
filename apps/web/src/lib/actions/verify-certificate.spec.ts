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
  return { ApiError, api: { get: jest.fn() }, serverApi: {} };
});
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
// winston's console transport schedules with setImmediate, which jsdom lacks.
// The logger is an I/O boundary here, so it is replaced and its call asserted.
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }));

import { api, ApiError } from '@/lib/api/server';
import { logger } from '@/lib/logger';
import { verifyCertificate } from './kbs';

const get = api.get as jest.MockedFunction<typeof api.get>;
const logged = logger.error as jest.MockedFunction<typeof logger.error>;

/**
 * The server action behind `/verify-certificate`, tested on its own.
 *
 * The page test mocks this module, so it proves the page renders an honest
 * verdict and nothing about whether the verdict is honest. This is that half:
 * whatever goes wrong between here and the register, the answer is never
 * `valid`.
 */
describe('verifyCertificate (server action)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks the public verification route, with the number encoded', async () => {
    get.mockResolvedValue({ status: 'UNKNOWN', valid: false, message: 'Certificat introuvable' });

    await verifyCertificate('KCA/../x');

    expect(get).toHaveBeenCalledWith('/kbs/public/verify/KCA%2F..%2Fx');
  });

  it("reads the register's unknown answer as unknown", async () => {
    get.mockResolvedValue({ status: 'UNKNOWN', valid: false, message: 'Certificat introuvable' });

    await expect(verifyCertificate('KCA-00000000-FAKE')).resolves.toEqual({
      success: true,
      data: { kind: 'unknown' },
    });
  });

  it('reads a 404 as unknown', async () => {
    get.mockRejectedValue(new ApiError('Not found', 404));

    await expect(verifyCertificate('KCA-00000000-FAKE')).resolves.toEqual({
      success: true,
      data: { kind: 'unknown' },
    });
  });

  it('reads a broken API as unavailable, not as unknown and never as valid', async () => {
    get.mockRejectedValue(new ApiError('Internal server error', 500));

    await expect(verifyCertificate('KCA-20250101-0001')).resolves.toEqual({
      success: true,
      data: { kind: 'unavailable' },
    });
    // A page that says "cannot verify" to a visitor must leave a line an
    // operator can find: otherwise the outage is visible only to strangers.
    expect(logged).toHaveBeenCalledWith(
      'CertificateVerificationUnavailable',
      expect.objectContaining({ status: 500 }),
    );
  });

  it('reads an API that was never reached as unavailable', async () => {
    // What fetch throws when the connection is refused or DNS fails.
    get.mockRejectedValue(new TypeError('fetch failed'));

    await expect(verifyCertificate('KCA-20250101-0001')).resolves.toEqual({
      success: true,
      data: { kind: 'unavailable' },
    });
  });
});
