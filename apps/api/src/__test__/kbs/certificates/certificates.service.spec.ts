import { ConflictException, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '@kambriq/common';
import { UsersService } from '../../../core/users/users.service';
import { KbsCertificatesService } from '../../../kbs/certificates/certificates.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import {
  buildCandidate,
  buildCertificate,
  buildUserResponse,
  mockEmailService,
  mockI18n,
  mockKbsPrisma,
  resetIdCounter,
} from '../../utils';

describe('KbsCertificatesService', () => {
  let service: KbsCertificatesService;
  let prisma: ReturnType<typeof mockKbsPrisma>;
  let usersService: {
    addRole: jest.Mock;
    findById: jest.Mock;
    removeRole: jest.Mock;
  };
  let emailService: ReturnType<typeof mockEmailService>;

  beforeEach(async () => {
    resetIdCounter();
    prisma = mockKbsPrisma();
    emailService = mockEmailService();
    usersService = {
      addRole: jest.fn(),
      removeRole: jest.fn(),
      findById: jest.fn().mockResolvedValue(buildUserResponse()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsCertificatesService,
        { provide: KbsPrismaService, useValue: prisma },
        { provide: I18nService, useValue: mockI18n() },
        { provide: UsersService, useValue: usersService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(KbsCertificatesService);
  });

  // ----- ISSUE CERTIFICATE ----- //

  describe('issueCertificate', () => {
    it('issues certificate, grants KCA role, sends email', async () => {
      const candidate = buildCandidate({
        status: 'CERTIFIED',
        certificate: null,
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCandidateProgress.findFirst.mockResolvedValue({ passed: true });

      const cert = buildCertificate({ candidateId: candidate.id });
      prisma.kbsCertificate.create.mockResolvedValue(cert);
      prisma.kbsCandidate.update.mockResolvedValue({});

      const result = await service.issueCertificate(candidate.id, 'admin-1');

      expect(result.kcaNumber).toMatch(/^KCA-/);
      expect(usersService.addRole).toHaveBeenCalledWith(
        candidate.userId,
        'KCA_CERTIFIED',
        'admin-1',
      );
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({ template: 'certificateIssued' }),
      );
    });

    it('throws ConflictException if certificate already exists', async () => {
      const candidate = buildCandidate({
        status: 'CERTIFIED',
        certificate: buildCertificate(),
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCandidateProgress.findFirst.mockResolvedValue({ passed: true });

      await expect(
        service.issueCertificate(candidate.id, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException if candidate does not exist', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);

      await expect(
        service.issueCertificate('bad-id', 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----- VERIFY CERTIFICATE (Public) ----- //

  describe('verifyCertificate', () => {
    it('returns valid=true for a non-expired certificate', async () => {
      const cert = buildCertificate({
        validUntil: new Date(Date.now() + 365 * 86_400_000), // +1yr
        candidate: { userId: 'u1', certifiedAt: new Date() },
      });
      prisma.kbsCertificate.findUnique.mockResolvedValue(cert);

      const result = await service.verifyCertificate(cert.kcaNumber);

      expect(result.valid).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.kcaNumber).toBe(cert.kcaNumber);
    });

    it('returns valid=false for an expired certificate', async () => {
      const cert = buildCertificate({
        validUntil: new Date(Date.now() - 86_400_000), // yesterday
        candidate: { userId: 'u1', certifiedAt: new Date() },
      });
      prisma.kbsCertificate.findUnique.mockResolvedValue(cert);

      const result = await service.verifyCertificate(cert.kcaNumber);

      expect(result.valid).toBe(false);
      expect(result.isExpired).toBe(true);
    });

    it('returns valid=false for an unknown KCA number', async () => {
      prisma.kbsCertificate.findUnique.mockResolvedValue(null);

      const result = await service.verifyCertificate('KCA-FAKE-0000');
      expect(result.valid).toBe(false);
    });
  });

  // ----- REVOKE CERTIFICATE ----- //

  describe('revokeCertificate', () => {
    it('stamps revokedAt, reverts candidate status, removes KCA role', async () => {
      const cert = buildCertificate({ revokedAt: null });
      const candidate = buildCandidate({
        status: 'CERTIFIED',
        certificate: cert,
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);
      prisma.kbsCertificate.update.mockResolvedValue({
        ...cert,
        revokedAt: new Date(),
      });
      prisma.kbsCandidate.update.mockResolvedValue({});

      const result = await service.revokeCertificate(candidate.id, 'admin-1', {
        reason: 'Fraudulent activity',
      });

      expect(prisma.kbsCertificate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            revokedAt: expect.any(Date),
            revokedBy: 'admin-1',
            revokeReason: 'Fraudulent activity',
          }),
        }),
      );
      expect(prisma.kbsCandidate.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'EXAM_PENDING' }),
        }),
      );
      expect(usersService.removeRole).toHaveBeenCalledWith(
        candidate.userId,
        'KCA_CERTIFIED',
      );
      expect(result).toHaveProperty('revokedAt');
    });

    it('throws NotFoundException when candidate does not exist', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);

      await expect(
        service.revokeCertificate('bad-id', 'admin-1', { reason: 'Reason' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when candidate has no certificate', async () => {
      const candidate = buildCandidate({
        status: 'CERTIFIED',
        certificate: null,
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      await expect(
        service.revokeCertificate(candidate.id, 'admin-1', {
          reason: 'Reason',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when certificate already revoked', async () => {
      const cert = buildCertificate({ revokedAt: new Date('2025-03-01') });
      const candidate = buildCandidate({
        status: 'CERTIFIED',
        certificate: cert,
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      await expect(
        service.revokeCertificate(candidate.id, 'admin-1', {
          reason: 'Reason',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ----- FIND BY USER ID (candidate's view) ----- //

  describe('findByUserId', () => {
    it('returns certificate details with validity flag', async () => {
      const candidate = buildCandidate({
        certificate: buildCertificate({
          validUntil: new Date(Date.now() + 86_400_000),
        }),
      });
      prisma.kbsCandidate.findUnique.mockResolvedValue(candidate);

      const result = await service.findByUserId(candidate.userId);

      expect(result).toHaveProperty('kcaNumber');
      expect(result.isValid).toBe(true);
    });

    it('returns null if candidate has no certificate', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(
        buildCandidate({ certificate: null }),
      );

      const result = await service.findByUserId('u1');
      expect(result).toBeNull();
    });

    it('throws NotFoundException if not enrolled', async () => {
      prisma.kbsCandidate.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
