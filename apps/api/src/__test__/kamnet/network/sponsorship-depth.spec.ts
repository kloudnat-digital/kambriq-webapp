import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { KamnetNetworkService } from '../../../kamnet/network/network.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { buildUserResponse, mockI18n } from '../../utils';

/**
 * P9 - sponsorship stops at the direct sponsor.
 *
 * Visquis arbitrated on 20 September: a sale pays the agent who made it
 * (level 0) and their direct sponsor (level 1), and nobody beyond.
 * `KAMNET_MAX_SPONSORSHIP_DEPTH` is what enforces that, and it is read by both
 * directions of the tree - walking DOWN through `getMyNetwork` and UP through
 * `getMySponsorChain`.
 *
 * ---------------------------------------------------------------------------
 * Why the fixture is deeper than the answer
 * ---------------------------------------------------------------------------
 * The chain is built four agents deep in both directions, and the caller asks
 * for depth 3. A response that stops at one level therefore proves the CLAMP,
 * not the shape of the data - which is the failure mode a shallow fixture
 * produces: it agrees with every possible limit, so it discriminates between
 * none of them.
 *
 * ---------------------------------------------------------------------------
 * Why the assertions name LEVELS and not counts
 * ---------------------------------------------------------------------------
 * "The chain has one entry" passes for the wrong reason the day the walk breaks
 * early for an unrelated cause - a missing sponsor row, a rejected lookup. So
 * the sponsor chain is asserted on the `level` values actually present, and the
 * tree on whether a second level of nesting exists at all.
 */
describe('P9 - the sponsorship tree stops at the direct sponsor', () => {
  let service: KamnetNetworkService;

  /** a1 is the caller. Upward: a1 <- a2 <- a3 <- a4. Downward: a1 -> b1 -> b2 -> b3. */
  const AGENTS: Record<string, { id: string; sponsorId: string | null }> = {
    a1: { id: 'a1', sponsorId: 'a2' },
    a2: { id: 'a2', sponsorId: 'a3' },
    a3: { id: 'a3', sponsorId: 'a4' },
    a4: { id: 'a4', sponsorId: null },
    b1: { id: 'b1', sponsorId: 'a1' },
    b2: { id: 'b2', sponsorId: 'b1' },
    b3: { id: 'b3', sponsorId: 'b2' },
  };

  const CHILDREN: Record<string, string[]> = {
    a1: ['b1'],
    b1: ['b2'],
    b2: ['b3'],
  };

  const row = (id: string) => ({
    id,
    userId: `u-${id}`,
    agentCode: `AGT-${id}`,
    tier: 'JUNIOR',
    salesCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    sponsorId: AGENTS[id].sponsorId,
  });

  beforeEach(async () => {
    const prisma = {
      kamnetAgent: {
        findUnique: jest.fn(({ where, include }) => {
          const id = where.userId ? where.userId.replace('u-', '') : where.id;
          if (!AGENTS[id]) return Promise.resolve(null);
          const base = row(id);
          const sponsorId = AGENTS[id].sponsorId;
          return Promise.resolve(
            include?.sponsor ? { ...base, sponsor: sponsorId ? row(sponsorId) : null } : base,
          );
        }),
        findMany: jest.fn(({ where }) =>
          Promise.resolve((CHILDREN[where.sponsorId] ?? []).map(row)),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetNetworkService,
        { provide: KamnetPrismaService, useValue: prisma },
        {
          provide: UsersService,
          useValue: { findById: jest.fn().mockResolvedValue(buildUserResponse({})) },
        },
        { provide: I18nService, useValue: mockI18n() },
      ],
    }).compile();

    service = module.get(KamnetNetworkService);
  });

  /**
   * Without this, every assertion below passes against a fixture one level
   * deep - agreeing with a clamp of 1, of 3, and with no clamp at all.
   */
  it('has a fixture deeper than the answer it expects', () => {
    expect(CHILDREN['b1']).toEqual(['b2']);
    expect(CHILDREN['b2']).toEqual(['b3']);
    expect(AGENTS['a2'].sponsorId).toBe('a3');
    expect(AGENTS['a3'].sponsorId).toBe('a4');
  });

  it('walks up to the direct sponsor and no further', async () => {
    const { chain } = await service.getMySponsorChain('u-a1');

    expect(chain.map((entry) => entry.level)).toEqual([1]);
  });

  it('answers a request for depth 3 with one level of referrals', async () => {
    const tree = await service.getMyNetwork('u-a1', 3);

    // The caller's own referrals are served - this is not an empty answer.
    expect(tree?.referrals).toHaveLength(1);
    // And their referrals' referrals are not, however deep the data goes.
    const firstReferral = tree?.referrals[0] as { referrals: unknown[] };
    expect(firstReferral.referrals).toEqual([]);
  });
});
