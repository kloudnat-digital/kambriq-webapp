import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, KBS_JOBS, RoleCode } from '@kambriq/common';
import { UsersService } from '../../../core/users/users.service';
import { KbsCertificatesService } from '../../../kbs/certificates/certificates.service';
import { KbsCertificateExpiryScheduler } from '../../../kbs/certificates/certificate-expiry.scheduler';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { mockEmailService, mockI18n, mockKbsPrisma, mockQueue } from '../../utils';

/**
 * I15 - expiry withdraws the role, as revocation already did.
 *
 * Nothing happened when a certificate expired: the status stayed CERTIFIED and
 * the role stayed on the account, so the platform went on treating as certified
 * somebody `/verify-certificate` answered "expiré" for. The role is a
 * projection of the certificate; a projection that outlives what it projects is
 * the defect.
 */
describe('KbsCertificatesService.withdrawExpiredCertifications', () => {
  let service: KbsCertificatesService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let usersService: { removeRole: jest.Mock; addRole: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    prisma = mockKbsPrisma();
    usersService = { removeRole: jest.fn(), addRole: jest.fn(), findById: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsCertificatesService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: I18nService, useValue: mockI18n() },
        { provide: UsersService, useValue: usersService },
        { provide: EmailService, useValue: mockEmailService() },
      ],
    }).compile();

    service = module.get(KbsCertificatesService);
  });

  const now = new Date('2027-01-02T02:30:00Z');

  it('removes KCA_CERTIFIED from every holder whose certificate has expired', async () => {
    prisma.kbsCertificate.findMany.mockResolvedValue([
      { kcaNumber: 'KCA-20250101-0001', candidate: { userId: 'u1' } },
      { kcaNumber: 'KCA-20250101-0002', candidate: { userId: 'u2' } },
    ]);

    const withdrawn = await service.withdrawExpiredCertifications(now);

    expect(prisma.kbsCertificate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { validUntil: { lt: now } } }),
    );
    expect(usersService.removeRole).toHaveBeenCalledWith('u1', RoleCode.KCA_CERTIFIED);
    expect(usersService.removeRole).toHaveBeenCalledWith('u2', RoleCode.KCA_CERTIFIED);
    expect(withdrawn).toBe(2);
  });

  it('touches nobody when no certificate has expired', async () => {
    prisma.kbsCertificate.findMany.mockResolvedValue([]);

    expect(await service.withdrawExpiredCertifications(now)).toBe(0);
    expect(usersService.removeRole).not.toHaveBeenCalled();
  });
});

describe('KbsCertificateExpiryScheduler', () => {
  it('registers one daily repeatable sweep, under a fixed id so a restart does not add another', async () => {
    const queue = mockQueue();
    const scheduler = new KbsCertificateExpiryScheduler(queue as never);

    await scheduler.onModuleInit();

    expect(queue.add).toHaveBeenCalledWith(
      KBS_JOBS.WITHDRAW_EXPIRED_CERTIFICATIONS,
      {},
      expect.objectContaining({
        jobId: 'withdraw-expired-certifications-cron',
        repeat: { pattern: expect.any(String) },
      }),
    );
  });
});
