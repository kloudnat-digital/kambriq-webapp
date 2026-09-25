import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, KamnetAgentTier, RedisService } from '@kambriq/common';
import { KamnetAgentsService } from '../../../kamnet/agents/agents.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { buildUserResponse, mockI18n } from '../../utils';

/**
 * Tests the rule that promotion to MANAGER requires only sales (not referrals).
 * The fixture specifically sets referrals to 0 to ensure the referral requirement is no longer enforced.
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

  // Control case to verify that the sales requirement itself is still enforced.
  it('does not promote an agent who is still short of ten sales', async () => {
    prisma.kamnetAgent.findUnique.mockResolvedValue(
      agentRow({ salesCount: 9, _count: { referrals: 50 } }),
    );

    await expect(service.checkPromotion('agent-1')).resolves.toBeNull();
    expect(prisma.kamnetAgent.update).not.toHaveBeenCalled();
  });

  // Verify lower tier promotion rules remain intact.
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
