import { base, makeService } from './service-fixture';

/**
 * C16 - the same write is accepted once the title is listed with its source.
 *
 * The registry is replaced here, never in the shipped file: TF 9085/SM is the
 * title 010A and 010B are carved from, not a lot's own, so it must not be
 * listed for real. This proves the door opens by the registry and nothing else.
 */
jest.mock('@kambriq/common', () => ({
  ...jest.requireActual('@kambriq/common'),
  REAL_TITLES: [
    { titleNumber: 'TF 9085/SM', source: 'test only - prd_lands_catalogue_v07.5.docx, fiche 010A' },
  ],
}));

describe('C16 - a listed title is accepted by the API', () => {
  it('writes it on create and on update', async () => {
    const { service, writes } = makeService();
    await service.create({ ...(base as object), titleNumber: 'TF 9085/SM' } as never, 'admin');
    await service.update('land', { titleNumber: 'TF 9085/SM' } as never, 'admin');
    expect(writes).toEqual([
      expect.objectContaining({ titleNumber: 'TF 9085/SM' }),
      expect.objectContaining({ titleNumber: 'TF 9085/SM' }),
    ]);
  });

  it('still refuses a title the registry does not list', async () => {
    const { service } = makeService();
    await expect(
      service.create({ ...(base as object), titleNumber: 'TF 4129/M' } as never, 'admin'),
    ).rejects.toThrow(/registre des titres vérifiés/);
  });
});
