import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, KamnetApplicationStatus } from '@kambriq/common';
import { KamnetApplicationsService } from '../../../kamnet/applications/applications.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { UsersService } from '../../../core/users/users.service';
import { KbsCertificatesService } from '../../../kbs/certificates/certificates.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { buildUserResponse, mockEmailService, mockI18n } from '../../utils';

/**
 * I15 - "is this person certified" is answered by the certificate, through
 * `isUserCertified`, at both doors into KAMNET.
 *
 * Submission asked a different question: is the number the caller TYPED a
 * valid certificate? Any valid number passed - somebody else's included - and
 * the application stored it as the applicant's. Approval asked nothing at all,
 * so a certificate revoked or expired between submission and review still
 * became an agent.
 */
describe('KamnetApplicationsService - the certificate decides', () => {
  const OWN = 'KCA-20250101-0001';
  const SOMEONE_ELSES = 'KCA-20250101-0002';
  const inAYear = new Date(Date.now() + 365 * 86_400_000);

  let service: KamnetApplicationsService;
  let prisma: {
    kamnetApplication: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    kamnetAgent: { findUnique: jest.Mock; create: jest.Mock };
  };
  let usersService: { findById: jest.Mock; addRole: jest.Mock };
  let certificates: { verifyCertificate: jest.Mock };
  let candidates: { findActiveCertificate: jest.Mock; isUserCertified: jest.Mock };

  beforeEach(async () => {
    prisma = {
      kamnetApplication: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      kamnetAgent: { findUnique: jest.fn(), create: jest.fn() },
    };
    usersService = {
      findById: jest.fn().mockResolvedValue(buildUserResponse({ language: 'fr' })),
      addRole: jest.fn(),
    };
    // A stranger's valid number verifies as VALID: that is the point of the test.
    certificates = {
      verifyCertificate: jest.fn().mockResolvedValue({ status: 'VALID', valid: true }),
    };
    candidates = { findActiveCertificate: jest.fn(), isUserCertified: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetApplicationsService,
        { provide: KamnetPrismaService, useValue: prisma },
        { provide: UsersService, useValue: usersService },
        { provide: KbsCertificatesService, useValue: certificates },
        { provide: KbsCandidatesService, useValue: candidates },
        { provide: EmailService, useValue: mockEmailService() },
        { provide: I18nService, useValue: mockI18n() },
      ],
    }).compile();

    service = module.get(KamnetApplicationsService);
  });

  describe('submit', () => {
    beforeEach(() => {
      prisma.kamnetApplication.findUnique.mockResolvedValue(null);
      prisma.kamnetAgent.findUnique.mockResolvedValue(null);
      prisma.kamnetApplication.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'app-1', ...data }),
      );
    });

    it('refuses a caller who holds no active certificate, whatever number they type', async () => {
      candidates.findActiveCertificate.mockResolvedValue(null);
      candidates.isUserCertified.mockResolvedValue(false);

      await expect(service.submit('u1', { kcaNumber: SOMEONE_ELSES })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.kamnetApplication.create).not.toHaveBeenCalled();
    });

    it("refuses a valid number that is not the caller's own certificate", async () => {
      candidates.findActiveCertificate.mockResolvedValue({ kcaNumber: OWN, validUntil: inAYear });
      candidates.isUserCertified.mockResolvedValue(true);

      await expect(service.submit('u1', { kcaNumber: SOMEONE_ELSES })).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.kamnetApplication.create).not.toHaveBeenCalled();
    });

    it("accepts the caller's own active certificate and stores that number", async () => {
      candidates.findActiveCertificate.mockResolvedValue({ kcaNumber: OWN, validUntil: inAYear });
      candidates.isUserCertified.mockResolvedValue(true);

      await service.submit('u1', { kcaNumber: OWN });

      expect(prisma.kamnetApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', kcaNumber: OWN }),
        }),
      );
    });
  });

  describe('review', () => {
    const pending = {
      id: 'app-1',
      userId: 'u1',
      status: KamnetApplicationStatus.PENDING,
      kcaNumber: OWN,
      sponsorCode: null,
    };

    it('refuses to approve an applicant who is no longer certified', async () => {
      prisma.kamnetApplication.findUnique.mockResolvedValue(pending);
      candidates.isUserCertified.mockResolvedValue(false);

      await expect(
        service.review('app-1', 'admin-1', { status: KamnetApplicationStatus.APPROVED }),
      ).rejects.toThrow(ForbiddenException);

      // Nothing half-done: no decision recorded, no agent, no role.
      expect(prisma.kamnetApplication.update).not.toHaveBeenCalled();
      expect(prisma.kamnetAgent.create).not.toHaveBeenCalled();
      expect(usersService.addRole).not.toHaveBeenCalled();
    });

    it('still lets an admin reject an applicant who is no longer certified', async () => {
      prisma.kamnetApplication.findUnique.mockResolvedValue(pending);
      prisma.kamnetApplication.update.mockResolvedValue({
        ...pending,
        status: KamnetApplicationStatus.REJECTED,
      });
      candidates.isUserCertified.mockResolvedValue(false);

      await service.review('app-1', 'admin-1', { status: KamnetApplicationStatus.REJECTED });

      expect(prisma.kamnetApplication.update).toHaveBeenCalled();
      expect(usersService.addRole).not.toHaveBeenCalled();
    });
  });
});
