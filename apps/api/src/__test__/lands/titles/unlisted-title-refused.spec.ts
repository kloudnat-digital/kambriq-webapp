import { UnprocessableEntityException } from '@nestjs/common';
import { REAL_TITLES, REAL_TITLES_FILE } from '@kambriq/common';
import { base, makeService } from './service-fixture';

/**
 * C16 - the API refuses a title the reviewed registry does not list.
 *
 * The shape (P24) cannot tell an invented title from a real one, and the back
 * office could type one: that is how a database ends up asserting titles on
 * parcels that do not exist. `real-titles.ts` is empty, so today any non-null
 * title is refused, including a real one - TF 9085/SM is on fiche 010A - until
 * somebody lists it with its source in a reviewed change.
 */
describe('C16 - an unlisted title is refused by the API', () => {
  it('is reading the registry as it ships: empty', () => {
    expect(REAL_TITLES).toEqual([]);
  });

  it.each([
    [
      'create',
      (s: ReturnType<typeof makeService>['service'], t: string) =>
        s.create({ ...(base as object), titleNumber: t } as never, 'admin'),
    ],
    [
      'update',
      (s: ReturnType<typeof makeService>['service'], t: string) =>
        s.update('land', { titleNumber: t } as never, 'admin'),
    ],
  ])('refuses it on %s, and writes nothing', async (_name, write) => {
    const { service, writes } = makeService();
    const refusal = write(service, 'TF 9085/SM');
    await expect(refusal).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(writes).toEqual([]);
  });

  it('names the file to edit, and never echoes the value it received', async () => {
    const { service } = makeService();
    const message = await service
      .create({ ...(base as object), titleNumber: 'TF 9085/SM' } as never, 'admin')
      .then(
        () => '',
        (e: Error) => e.message,
      );
    expect(message).toContain(REAL_TITLES_FILE);
    expect(message).not.toMatch(/9085|TF \d/);
  });

  it('still writes a parcel with no title: a null title is better than a wrong one', async () => {
    const { service, writes } = makeService();
    await service.create(base, 'admin');
    await service.update('land', { titleNumber: '' } as never, 'admin');
    expect(writes).toHaveLength(2);
  });
});
