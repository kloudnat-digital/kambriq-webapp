import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import { PolicyArchiveService } from '../../cms/policy-archive.service';
import { UnrenderablePolicyError } from '../../cms/policy-render';
import type { PolicyPublishPayload } from '../../cms/policy-publish.dto';

const payload = (overrides: Partial<PolicyPublishPayload> = {}): PolicyPublishPayload => ({
  _id: 'legalPolicy-privacy-fr',
  _rev: 'rev-aaaaaaaa',
  _type: 'legalPolicy',
  locale: 'fr',
  slug: 'legal-privacy',
  publishedAt: '2026-09-25T10:00:00.000Z',
  body: [
    {
      _type: 'block',
      _key: 'b1',
      style: 'h1',
      children: [{ _type: 'span', _key: 's1', text: 'Politique de confidentialite', marks: [] }],
    },
  ],
  ...overrides,
});

/**
 * Prisma's unique-index refusal. Only `code` is read by the service: which index
 * refused is settled by reading the row back, because Prisma 7's pg adapter puts
 * the columns under `meta.driverAdapterError` and sets no `meta.target`.
 */
const uniqueViolation = () =>
  Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

describe('PolicyArchiveService', () => {
  let create: jest.Mock;
  let findFirst: jest.Mock;
  let service: PolicyArchiveService;

  beforeEach(() => {
    create = jest.fn().mockResolvedValue({ id: 'snapshot-1' });
    findFirst = jest.fn().mockResolvedValue(null);
    service = new PolicyArchiveService({
      policySnapshot: { create, findFirst },
    } as unknown as CorePrismaService);
  });

  it('stores the rendered HTML, not the Portable Text', async () => {
    await service.archive(payload());

    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data).toMatchObject({
      documentId: 'legalPolicy-privacy-fr',
      revision: 'rev-aaaaaaaa',
      locale: 'fr',
      slug: 'legal-privacy',
      rendered: '<h1>Politique de confidentialite</h1>',
      publishedAt: new Date('2026-09-25T10:00:00.000Z'),
    });
  });

  it('reports what it did, rather than returning nothing', async () => {
    await expect(service.archive(payload())).resolves.toEqual({
      status: 'archived',
      id: 'snapshot-1',
      slug: 'legal-privacy',
      locale: 'fr',
      revision: 'rev-aaaaaaaa',
    });
  });

  describe('a delivery repeated by Sanity', () => {
    /**
     * Sanity retries a delivery it got no answer to, and the retry carries the
     * same revision. The unique index refuses it; the outcome has to say so, so
     * the controller can answer 2xx and stop the retries.
     */
    it('is already-archived when that revision is on the ledger', async () => {
      create.mockRejectedValue(uniqueViolation());
      findFirst.mockResolvedValue({ id: 'snapshot-1' });

      await expect(service.archive(payload())).resolves.toEqual({
        status: 'already-archived',
        slug: 'legal-privacy',
        locale: 'fr',
        revision: 'rev-aaaaaaaa',
      });
    });

    it('asks for that document and that revision, not for the slug', async () => {
      create.mockRejectedValue(uniqueViolation());
      findFirst.mockResolvedValue({ id: 'snapshot-1' });

      await service.archive(payload());

      expect(findFirst.mock.calls[0][0].where).toEqual({
        documentId: 'legalPolicy-privacy-fr',
        revision: 'rev-aaaaaaaa',
      });
    });
  });

  it('rethrows a unique violation when no such revision was archived', async () => {
    // A P2002 from some other index. Swallowing every one of them would turn an
    // unrelated conflict into a silent success.
    create.mockRejectedValue(uniqueViolation());
    findFirst.mockResolvedValue(null);

    await expect(service.archive(payload())).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rethrows any other database error rather than reporting success', async () => {
    create.mockRejectedValue(new Error('connection terminated'));

    await expect(service.archive(payload())).rejects.toThrow('connection terminated');
  });

  it('refuses a document it cannot render completely, and writes nothing', async () => {
    await expect(
      service.archive(payload({ body: [{ _type: 'pricingTable', _key: 'x1' }] })),
    ).rejects.toThrow(UnrenderablePolicyError);

    expect(create).not.toHaveBeenCalled();
  });

  describe('a document type this webhook does not archive', () => {
    it('is ignored explicitly, and nothing is written', async () => {
      await expect(service.archive(payload({ _type: 'blogPost' }))).resolves.toEqual({
        status: 'ignored',
        reason: 'not a legalPolicy document',
      });

      expect(create).not.toHaveBeenCalled();
    });
  });
});
