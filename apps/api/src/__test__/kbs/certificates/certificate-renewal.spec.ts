import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { EmailService, RoleCode } from '@kambriq/common';
import { UsersService } from '../../../core/users/users.service';
import { KbsCandidatesService } from '../../../kbs/candidates/candidates.service';
import { KbsCertificatesService } from '../../../kbs/certificates/certificates.service';
import { KbsPrismaService } from '../../../kbs/prisma/kbs-prisma.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import {
  buildUserResponse,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockKbsPrisma,
  mockStorageService,
} from '../../utils';
import { StorageService } from '@kambriq/common';

/**
 * I15 renewal - a renewal issues a NEW certificate, with its own number and its
 * own dates (decided 15 September).
 *
 * `KbsCertificate.candidateId` was unique, so a candidate could hold one
 * certificate for life: `issueCertificate` answered 409 "already issued" to a
 * candidate whose certificate had expired or been revoked, and once expiry
 * withdrew the role (I15) nobody could ever be certified again. A candidate may
 * now hold several certificates over time; the current one is the latest
 * issued. The old one stays in the register, and `/verify-certificate` goes on
 * answering "expiré" or "révoqué" for its number.
 *
 * The mocks give each candidate both the one `certificate` today's code reads
 * and the `certificates` history, newest first, that a renewal creates.
 */
describe('I15 renewal', () => {
  const day = 86_400_000;
  const expired = {
    id: 'cert-old',
    kcaNumber: 'KCA-20240101-OLD1',
    issueDate: new Date(Date.now() - 800 * day),
    validUntil: new Date(Date.now() - 70 * day),
    revokedAt: null as Date | null,
  };
  const revoked = {
    ...expired,
    validUntil: new Date(Date.now() + 300 * day),
    revokedAt: new Date(),
  };
  const active = {
    id: 'cert-new',
    kcaNumber: 'KCA-20260915-NEW1',
    issueDate: new Date(Date.now() - day),
    validUntil: new Date(Date.now() + 700 * day),
    revokedAt: null as Date | null,
  };
  const candidateWith = (history: Array<typeof expired>) => ({
    id: 'cand-1',
    userId: 'u1',
    status: 'CERTIFIED',
    certificate: history[history.length - 1] ?? null, // today's single certificate: the first ever issued
    certificates: history, // newest first
  });

  let certificates: KbsCertificatesService;
  let candidates: KbsCandidatesService;
  let kbs: ReturnType<typeof mockKbsPrisma>;
  let users: { addRole: jest.Mock; removeRole: jest.Mock; findById: jest.Mock };

  beforeEach(async () => {
    kbs = mockKbsPrisma();
    users = {
      addRole: jest.fn(),
      removeRole: jest.fn(),
      findById: jest.fn().mockResolvedValue(buildUserResponse({ language: 'fr' })),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KbsCertificatesService,
        KbsCandidatesService,
        { provide: KbsPrismaService, useValue: kbs },
        { provide: CorePrismaService, useValue: mockCorePrisma() },
        { provide: UsersService, useValue: users },
        { provide: EmailService, useValue: mockEmailService() },
        { provide: StorageService, useValue: mockStorageService() },
        { provide: I18nService, useValue: mockI18n() },
      ],
    }).compile();
    certificates = module.get(KbsCertificatesService);
    candidates = module.get(KbsCandidatesService);
  });

  describe('issueCertificate', () => {
    const arrange = (history: Array<typeof expired>) => {
      kbs.kbsCandidate.findUnique.mockResolvedValue(candidateWith(history));
      kbs.kbsExam.findFirst.mockResolvedValue({ id: 'exam-1', status: 'PASSED' });
      kbs.kbsCertificate.findUnique.mockResolvedValue(null); // number generation: no collision
      kbs.kbsCertificate.create.mockImplementation(({ data }) =>
        Promise.resolve({ id: 'cert-created', ...data }),
      );
    };

    it('issues a new certificate, with a new number, when the predecessor has expired', async () => {
      arrange([expired]);

      const issued = await certificates.issueCertificate('cand-1', 'admin-1');

      expect(kbs.kbsCertificate.create).toHaveBeenCalledTimes(1);
      expect(issued.kcaNumber).not.toBe(expired.kcaNumber);
      expect(issued.validUntil.getTime()).toBeGreaterThan(Date.now());
      // The predecessor is not rewritten: it stays in the register as it was.
      expect(kbs.kbsCertificate.update).not.toHaveBeenCalled();
      expect(users.addRole).toHaveBeenCalledWith('u1', RoleCode.KCA_CERTIFIED, 'admin-1');
    });

    it('issues a new certificate when the predecessor was revoked', async () => {
      arrange([revoked]);

      await certificates.issueCertificate('cand-1', 'admin-1');

      expect(kbs.kbsCertificate.create).toHaveBeenCalledTimes(1);
      expect(kbs.kbsCertificate.update).not.toHaveBeenCalled();
    });

    it('still refuses a second certificate while the current one stands', async () => {
      arrange([active, expired]);

      await expect(certificates.issueCertificate('cand-1', 'admin-1')).rejects.toThrow(
        ConflictException,
      );
      expect(kbs.kbsCertificate.create).not.toHaveBeenCalled();
    });
  });

  describe('after a renewal', () => {
    it('the old number still verifies as expired, the new one as valid', async () => {
      kbs.kbsCertificate.findUnique.mockImplementation(({ where }) =>
        Promise.resolve([expired, active].find((c) => c.kcaNumber === where.kcaNumber) ?? null),
      );

      expect((await certificates.verifyCertificate(expired.kcaNumber)).status).toBe('EXPIRED');
      expect((await certificates.verifyCertificate(active.kcaNumber)).status).toBe('VALID');
    });

    it('the holder is certified by the new certificate', async () => {
      kbs.kbsCandidate.findUnique.mockResolvedValue(candidateWith([active, expired]));

      expect(await candidates.findActiveCertificate('u1')).toEqual({
        kcaNumber: active.kcaNumber,
        validUntil: active.validUntil,
      });
    });

    it('revocation revokes the current certificate, not the old one', async () => {
      kbs.kbsCandidate.findUnique.mockResolvedValue(candidateWith([active, expired]));
      kbs.kbsCertificate.update.mockResolvedValue({ id: active.id });
      kbs.kbsCandidate.update.mockResolvedValue({});

      await certificates.revokeCertificate('cand-1', 'admin-1', { reason: 'Fraud' });

      expect(kbs.kbsCertificate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: active.id } }),
      );
    });

    it('the expiry sweep does not withdraw the role from a holder whose new certificate stands', async () => {
      kbs.kbsCertificate.findMany.mockResolvedValue([
        {
          kcaNumber: expired.kcaNumber,
          candidate: { userId: 'u1', certificates: [active, expired] },
        },
      ]);

      expect(await certificates.withdrawExpiredCertifications()).toBe(0);
      expect(users.removeRole).not.toHaveBeenCalled();
    });
  });
});
