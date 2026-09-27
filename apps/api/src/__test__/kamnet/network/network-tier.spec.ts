jest.mock('@kambriq/common', () => ({
  ...jest.requireActual('@kambriq/common'),
  // Raised above today's 1 so the TIER is what limits the answer, not the
  // platform maximum. With both at 1 (P9) the tier rule is unobservable, which
  // is how it went unenforced (I32).
  KAMNET_MAX_SPONSORSHIP_DEPTH: 3,
  KAMNET_NETWORK_DEPTH_BY_TIER: { JUNIOR: 1, CONFIRMED: 2, MANAGER: 3 },
}));

import { Test } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { KamnetNetworkService } from '../../../kamnet/network/network.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { buildUserResponse, mockI18n } from '../../utils';

/**
 * I32 - the API decides how deep an agent sees their network, by the agent's
 * own tier. The page used to hold that rule and the API served whatever depth
 * was asked, up to the platform maximum. The API is the rule; the page asks.
 *
 * The caller a1 sponsors b1, who sponsors b2, who sponsors b3: deeper than any
 * answer expected below, so each depth is the clamp and not the data.
 */
type Node = { referrals: Node[] };
const levels = (node: Node | null | undefined): number => {
  let n = 0;
  let current = node;
  while (current && current.referrals.length > 0) {
    n += 1;
    current = current.referrals[0];
  }
  return n;
};

const serviceFor = async (tier: string) => {
  const CHILDREN: Record<string, string[]> = { a1: ['b1'], b1: ['b2'], b2: ['b3'] };
  const row = (id: string) => ({
    id,
    userId: `u-${id}`,
    agentCode: `AGT-${id}`,
    tier: id === 'a1' ? tier : 'JUNIOR',
    salesCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    sponsorId: null,
  });
  const prisma = {
    kamnetAgent: {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(row(where.userId ? where.userId.replace('u-', '') : where.id)),
      ),
      findMany: jest.fn(({ where }) => Promise.resolve((CHILDREN[where.sponsorId] ?? []).map(row))),
    },
  };
  const module = await Test.createTestingModule({
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
  return module.get(KamnetNetworkService);
};

describe('I32 - the caller tier limits the network, on the server', () => {
  it.each([
    ['JUNIOR', 1],
    ['CONFIRMED', 2],
    ['MANAGER', 3],
  ])('%s asking for 3 levels sees %i', async (tier, expected) => {
    const service = await serviceFor(tier);
    expect(levels((await service.getMyNetwork('u-a1', 3)) as Node)).toBe(expected);
  });

  it('a request below the allowance is honoured', async () => {
    const service = await serviceFor('MANAGER');
    expect(levels((await service.getMyNetwork('u-a1', 1)) as Node)).toBe(1);
  });

  it('with no depth asked, the answer is the tier allowance', async () => {
    const service = await serviceFor('CONFIRMED');
    expect(levels((await service.getMyNetwork('u-a1')) as Node)).toBe(2);
  });

  it('a tier the table does not know sees one level, never more', async () => {
    const service = await serviceFor('PLATINUM');
    expect(levels((await service.getMyNetwork('u-a1', 3)) as Node)).toBe(1);
  });
});

describe('I32 - the query does not choose for the caller', () => {
  it('an absent depth reaches the service as absent, not as 1', () => {
    const { networkTreeQuerySchema } = jest.requireActual('../../../kamnet/dto/kamnet.dto');
    expect(networkTreeQuerySchema.parse({}).depth).toBeUndefined();
  });
});
