import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, KamnetAgentTier, RedisService } from '@kambriq/common';
import { KamnetAgentsService } from '../../../kamnet/agents/agents.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { buildUserResponse, mockI18n } from '../../utils';

/**
 * P9 - MANAGER is earned by selling, not by recruiting.
 *
 * Visquis arbitrated on 20 September: ten sales, yes; ten referrals, no. The
 * referral relation and the network tree are untouched - referrals still exist
 * and still matter - they simply stop gating promotion.
 *
 * ---------------------------------------------------------------------------
 * Why the fixture gives the agent ZERO referrals
 * ---------------------------------------------------------------------------
 * That is the whole discrimination. An agent with ten sales AND ten referrals
 * is promoted under both the old rule and the new one, so a test built that way
 * cannot tell them apart and would stay green with the referral clause intact.
 * Zero referrals is the only fixture that fails while the old rule survives
 * anywhere - here, or in a copy of the condition somebody adds later.
 *
 * No existing test covered promotion at all, so there was nothing to invert:
 * this is new coverage over a rule that was previously unpinned in both its
 * old form and its new one.
 */
describe('P9 - promotion to MANAGER no longer requires referrals', () => {
  let service: KamnetAgentsService;
  let prisma: {
    kamnetAgent: { findUnique: jest.Mock; update: jest.Mock };
  };

  const agentRow = (over: Partial<Record<string, unknown>> = {}) => ({
    id: 'agent-1',
    userId: 'user-1',
    tier: KamnetAgentTier.CONFIRMED,
    salesCount: 10,
    suspendedAt: null,
    _count: { referrals: 0 },
    ...over,
  });

  beforeEach(async () => {
    prisma = {
      kamnetAgent: {
        findUnique: jest.fn(),
        update: jest.fn(({ data }) => Promise.resolve({ id: 'agent-1', ...data })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetAgentsService,
        { provide: KamnetPrismaService, useValue: prisma },
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn().mockResolvedValue(buildUserResponse({ language: 'fr' })),
          },
        },
        { provide: EmailService, useValue: { send: jest.fn(), sendUpdate: jest.fn() } },
        { provide: I18nService, useValue: mockI18n() },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: KbsCandidatesService, useValue: {} },
      ],
    }).compile();

    service = module.get(KamnetAgentsService);
  });

  it('promotes an agent with ten sales and no referrals at all', async () => {
    prisma.kamnetAgent.findUnique.mockResolvedValue(agentRow({ _count: { referrals: 0 } }));

    await service.checkPromotion('agent-1');

    expect(prisma.kamnetAgent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { tier: KamnetAgentTier.MANAGER },
    });
  });

  /**
   * The control. Without it, a service that promoted everything unconditionally
   * would pass the assertion above, and the test would be describing a bug.
   */
  it('does not promote an agent who is still short of ten sales', async () => {
    prisma.kamnetAgent.findUnique.mockResolvedValue(
      agentRow({ salesCount: 9, _count: { referrals: 50 } }),
    );

    await expect(service.checkPromotion('agent-1')).resolves.toBeNull();
    expect(prisma.kamnetAgent.update).not.toHaveBeenCalled();
  });

  /** The tier below is untouched by this decision and must stay that way. */
  it('still promotes JUNIOR to CONFIRMED on five sales', async () => {
    prisma.kamnetAgent.findUnique.mockResolvedValue(
      agentRow({ tier: KamnetAgentTier.JUNIOR, salesCount: 5 }),
    );

    await service.checkPromotion('agent-1');

    expect(prisma.kamnetAgent.update).toHaveBeenCalledWith({
      where: { id: 'agent-1' },
      data: { tier: KamnetAgentTier.CONFIRMED },
    });
  });
});
