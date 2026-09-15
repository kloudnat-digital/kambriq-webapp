import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, KamnetApplicationStatus, RedisService, RoleCode } from '@kambriq/common';
import { KamnetAgentsService } from '../../../kamnet/agents/agents.service';
import { KamnetApplicationsService } from '../../../kamnet/applications/applications.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { KbsCertificatesService } from '../../../kbs/certificates/certificates.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { buildUserResponse, mockEmailService, mockI18n, mockKbsPrisma } from '../../utils';

/**
 * I16 - suspension removes the power to act, and keeps the account.
 *
 * Decided 15 September: suspending a KAMNET agent removes AGENT and lifting
 * the suspension returns it; certificate revocation removes it the same way.
 * The role is present or absent, so lands needs to learn nothing new - there is
 * no extra rule a module could forget to read. Before this, suspension and
 * revocation changed no role at all: a suspended agent kept reserving land.
 *
 * The order was the whole subject: AGENT carried CLIENT by inheritance, so every
 * agent was first given CLIENT in their own right (one-off on dev, 5 rows) and
 * approval now grants CLIENT explicitly - see the last test.
 */
describe('I16 - the AGENT role follows the agent status', () => {
  const agent = { id: 'agent-1', userId: 'u-agent', suspendedAt: null as Date | null };
  let users: { findById: jest.Mock; addRole: jest.Mock; removeRole: jest.Mock };
  let candidates: { isUserCertified: jest.Mock; findActiveCertificate: jest.Mock };
  let kamnet: {
    kamnetAgent: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    kamnetApplication: { findUnique: jest.Mock; update: jest.Mock };
  };

  const build = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetAgentsService,
        KamnetApplicationsService,
        KbsCertificatesService,
        { provide: KamnetPrismaService, useValue: kamnet },
        { provide: KbsPrismaService, useValue: kbs },
        { provide: UsersService, useValue: users },
        { provide: KbsCandidatesService, useValue: candidates },
        { provide: EmailService, useValue: mockEmailService() },
        { provide: I18nService, useValue: mockI18n() },
        { provide: RedisService, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
      ],
    }).compile();
    return module;
  };
  let kbs: ReturnType<typeof mockKbsPrisma>;

  beforeEach(() => {
    users = {
      findById: jest.fn().mockResolvedValue(buildUserResponse({ language: 'fr' })),
      addRole: jest.fn(),
      removeRole: jest.fn(),
    };
    candidates = { isUserCertified: jest.fn(), findActiveCertificate: jest.fn() };
    kamnet = {
      kamnetAgent: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      kamnetApplication: { findUnique: jest.fn(), update: jest.fn() },
    };
    kbs = mockKbsPrisma();
  });

  it('suspension removes AGENT and keeps the agent record', async () => {
    kamnet.kamnetAgent.findUnique.mockResolvedValue({ ...agent });
    kamnet.kamnetAgent.update.mockResolvedValue({ ...agent, suspendedAt: new Date() });
    const service = (await build()).get(KamnetAgentsService);

    await service.suspend(agent.id, 'admin-1');

    expect(users.removeRole).toHaveBeenCalledWith(agent.userId, RoleCode.AGENT);
    expect(users.removeRole).not.toHaveBeenCalledWith(agent.userId, RoleCode.CLIENT);
  });

  it('lifting the suspension returns AGENT to an agent who is still certified', async () => {
    kamnet.kamnetAgent.findUnique.mockResolvedValue({ ...agent, suspendedAt: new Date() });
    kamnet.kamnetAgent.update.mockResolvedValue({ ...agent });
    candidates.isUserCertified.mockResolvedValue(true);
    const service = (await build()).get(KamnetAgentsService);

    await service.reactivate(agent.id, 'admin-1');

    expect(users.addRole).toHaveBeenCalledWith(agent.userId, RoleCode.AGENT, 'admin-1');
  });

  it('lifting the suspension does not return AGENT once the certificate is gone', async () => {
    kamnet.kamnetAgent.findUnique.mockResolvedValue({ ...agent, suspendedAt: new Date() });
    kamnet.kamnetAgent.update.mockResolvedValue({ ...agent });
    candidates.isUserCertified.mockResolvedValue(false);
    const service = (await build()).get(KamnetAgentsService);

    await service.reactivate(agent.id, 'admin-1');

    expect(users.addRole).not.toHaveBeenCalled();
  });

  it('certificate revocation removes AGENT as well as KCA_CERTIFIED', async () => {
    kbs.kbsCandidate.findUnique.mockResolvedValue({
      id: 'cand-1',
      userId: agent.userId,
      certificate: { id: 'cert-1', kcaNumber: 'KCA-20250101-0001', revokedAt: null },
    });
    kbs.kbsCertificate.update.mockResolvedValue({ id: 'cert-1' });
    kbs.kbsCandidate.update.mockResolvedValue({});
    const service = (await build()).get(KbsCertificatesService);

    await service.revokeCertificate('cand-1', 'admin-1', { reason: 'Fraud' });

    expect(users.removeRole).toHaveBeenCalledWith(agent.userId, RoleCode.KCA_CERTIFIED);
    expect(users.removeRole).toHaveBeenCalledWith(agent.userId, RoleCode.AGENT);
  });

  it('approval grants CLIENT in its own right, before AGENT, so no buyer access hangs on AGENT', async () => {
    kamnet.kamnetApplication.findUnique.mockResolvedValue({
      id: 'app-1',
      userId: 'u-new',
      status: KamnetApplicationStatus.PENDING,
      kcaNumber: 'KCA-20250101-0001',
      sponsorCode: null,
    });
    kamnet.kamnetApplication.update.mockResolvedValue({});
    kamnet.kamnetAgent.findUnique.mockResolvedValue(null);
    kamnet.kamnetAgent.create.mockResolvedValue({ id: 'agent-9' });
    candidates.isUserCertified.mockResolvedValue(true);
    const service = (await build()).get(KamnetApplicationsService);

    await service.review('app-1', 'admin-1', { status: KamnetApplicationStatus.APPROVED });

    const granted = users.addRole.mock.calls.map((c) => c[1]);
    expect(granted).toEqual([RoleCode.CLIENT, RoleCode.AGENT]);
  });
});
