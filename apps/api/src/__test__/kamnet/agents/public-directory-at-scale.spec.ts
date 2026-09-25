import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES, RedisService } from '@kambriq/common';
import { KamnetAgentsService } from '../../../kamnet/agents/agents.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { UsersService } from '../../../core/users/users.service';
import { mockEmailService, mockI18n } from '../../utils';

/**
 * P22 - the public directory at scale.
 *
 * `listPublicDirectory` asked the KBS database for each agent's certificate
 * one agent at a time, all at once, inside a `Promise.all`, against a pool of
 * ten connections - and with no bound on how many agents it read. Harmless at
 * ten agents; the shape of the access is the defect, so the shape is what is
 * tested: the number of certificate lookups for N agents, which must not grow
 * with N. A timing test would prove nothing on a loaded runner.
 *
 * What is counted is calls into the certificate layer and, below, Prisma calls
 * made by it - not SQL statements. Prisma may load a relation in two
 * statements; two is also a constant.
 */
const DAY = 24 * 60 * 60 * 1000;
const agentsOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    userId: `u-${i}`,
    publicListingConsentAt: new Date(Date.now() - (n - i) * DAY),
    suspendedAt: null,
  }));
const usersOf = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `u-${i}`,
    firstName: `Agent${i}`,
    lastName: 'Test',
    isActive: true,
    deletedAt: null,
    profile: { city: 'Douala', country: 'CM', avatarUrl: null },
  }));
const factsOf = (userId: string) => ({
  ownerUserId: userId,
  kcaNumber: `KCA-${userId}`,
  issueDate: new Date(Date.now() - 30 * DAY),
  validUntil: new Date(Date.now() + 300 * DAY),
  revokedAt: null,
});

describe('P22 - the public directory reads certificates in one query, and is bounded', () => {
  let kamnet: { kamnetAgent: { findMany: jest.Mock } };
  let users: { findDirectoryUsers: jest.Mock };
  let candidates: Record<string, jest.Mock>;
  let service: KamnetAgentsService;

  const listFor = async (n: number) => {
    kamnet.kamnetAgent.findMany.mockResolvedValue(agentsOf(n));
    users.findDirectoryUsers.mockResolvedValue(usersOf(n));
    return service.listPublicDirectory();
  };
  const certificateLookups = () =>
    Object.values(candidates).reduce((sum, fn) => sum + fn.mock.calls.length, 0);

  beforeEach(async () => {
    kamnet = { kamnetAgent: { findMany: jest.fn() } };
    users = { findDirectoryUsers: jest.fn() };
    candidates = {
      findNewestCertificateFacts: jest.fn(async (userId: string) => factsOf(userId)),
      findNewestCertificateFactsForUsers: jest.fn(
        async (ids: string[]) => new Map(ids.map((id) => [id, factsOf(id)])),
      ),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetAgentsService,
        { provide: KamnetPrismaService, useValue: kamnet },
        { provide: UsersService, useValue: users },
        { provide: KbsCandidatesService, useValue: candidates },
        { provide: EmailService, useValue: mockEmailService() },
        { provide: I18nService, useValue: mockI18n() },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();
    service = module.get(KamnetAgentsService);
  });

  it('makes the same number of certificate lookups for 3 agents and for 12 - one', async () => {
    await listFor(3);
    const forThree = certificateLookups();
    Object.values(candidates).forEach((fn) => fn.mockClear());
    await listFor(12);
    const forTwelve = certificateLookups();

    expect([forThree, forTwelve]).toEqual([1, 1]);
  });

  it('still pairs every agent with their own certificate', async () => {
    const entries = await listFor(12);
    expect(entries.map((e) => [e.firstName, e.kcaNumber])).toEqual(
      usersOf(12).map((u) => [u.firstName, `KCA-${u.id}`]),
    );
  });

  it('reads at most the cap of agents, oldest consent first', async () => {
    await listFor(3);
    expect(kamnet.kamnetAgent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES,
        orderBy: { publicListingConsentAt: 'asc' },
      }),
    );
  });

  it('says so in the log when the cap is reached, and not before', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      await listFor(KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES - 1);
      expect(warn).not.toHaveBeenCalled();
      await listFor(KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES);
      expect(warn).toHaveBeenCalledWith(
        'Public directory capped %o',
        expect.objectContaining({ cap: KAMNET_MAX_PUBLIC_DIRECTORY_ENTRIES }),
      );
    } finally {
      warn.mockRestore();
    }
  });
});

describe('P22 - the certificate lookup for many users', () => {
  const kbs = { kbsCandidate: { findMany: jest.fn() } };
  const lookup = (ids: string[]) =>
    (
      KbsCandidatesService.prototype as unknown as {
        findNewestCertificateFactsForUsers: (this: unknown, ids: string[]) => Promise<unknown>;
      }
    ).findNewestCertificateFactsForUsers.call({ prisma: kbs }, ids) as Promise<
      Map<string, ReturnType<typeof factsOf>>
    >;

  beforeEach(() => {
    kbs.kbsCandidate.findMany.mockReset();
    kbs.kbsCandidate.findMany.mockImplementation(async ({ where }) =>
      (where.userId.in as string[]).map((userId) => ({
        userId,
        // What the select returns: the facts, without an owner field of their own.
        certificates: [
          (({ kcaNumber, issueDate, validUntil, revokedAt }) => ({
            kcaNumber,
            issueDate,
            validUntil,
            revokedAt,
          }))(factsOf(userId)),
        ],
      })),
    );
  });

  it('is one Prisma call for 3 users and for 12', async () => {
    await lookup(['a', 'b', 'c']);
    await lookup(Array.from({ length: 12 }, (_, i) => `u${i}`));
    expect(kbs.kbsCandidate.findMany).toHaveBeenCalledTimes(2);
  });

  it('keys each newest certificate by its owner, the owner travelling with the facts', async () => {
    const byUser = await lookup(['a', 'b']);
    expect(byUser.get('a')?.ownerUserId).toBe('a');
    expect(byUser.get('b')?.kcaNumber).toBe('KCA-b');
    expect(kbs.kbsCandidate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          certificates: expect.objectContaining({ take: 1 }),
        }),
      }),
    );
  });

  it('asks nothing for nobody', async () => {
    expect((await lookup([])).size).toBe(0);
    expect(kbs.kbsCandidate.findMany).not.toHaveBeenCalled();
  });
});
