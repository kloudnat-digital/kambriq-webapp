import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { IssueCertificateDto, RevokeCertificateDto } from './dto/certificate.dto';
import {
  buildPaginatedResponse,
  CandidateStatus,
  DEFAULT_LANGUAGE,
  EmailService,
  ExamStatus,
  PaginationQuery,
  RoleCode,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { DateTime } from 'luxon';

/** The verdict `verifyCertificate` gives the public. Exactly one applies. */
export type CertificateVerificationStatus = 'VALID' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN';

@Injectable()
export class KbsCertificatesService {
  private readonly logger = new Logger(KbsCertificatesService.name);

  constructor(
    private readonly prisma: KbsPrismaService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Admin: Issue Certificate ---------------------------
  async issueCertificate(candidateId: string, adminUserId: string, dto?: IssueCertificateDto) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { id: candidateId },
      include: { certificate: true },
    });

    if (!candidate) {
      throw new NotFoundException(
        this.t('kbs.certificate.candidateNotFound', undefined, {
          id: candidateId,
        }),
      );
    }

    // Requirement: the candidate has passed the final exam, or is already
    // certified (re-issue). `kbsCandidateProgress` records MODULE quizzes, not
    // the exam, so on its own it would let anybody who passed one quiz be
    // issued a certificate. The exam is the thing being certified, so it is the
    // exam that is checked.
    const passedExam = await this.prisma.kbsExam.findFirst({
      where: { candidateId, status: ExamStatus.PASSED },
    });

    if (
      candidate.status !== CandidateStatus.CERTIFIED &&
      candidate.status !== CandidateStatus.EXAM_PASSED &&
      !passedExam
    ) {
      this.logger.warn(
        'Attempt to issue certificate failed - candidate has not passed final exam %o',
        { candidateId, status: candidate.status },
      );
      throw new NotFoundException(this.t('kbs.certificate.notPassed', DEFAULT_LANGUAGE));
    }

    // Prevent duplicate certificates
    if (candidate.certificate) {
      throw new ConflictException(
        this.t('kbs.certificate.alreadyIssued', DEFAULT_LANGUAGE, {
          kcaNumber: candidate.certificate.kcaNumber,
        }),
      );
    }

    // Generate unique KCA number: KCA-YYYYMMDD-NNNN (sequential per day)
    const kcaNumber = await this.generateKcaNumber();

    // 2-year validity
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + 2);

    const certificate = await this.prisma.kbsCertificate.create({
      data: {
        candidateId,
        kcaNumber,
        validUntil,
        pdfUrl: dto?.pdfUrl || null,
        issuedBy: adminUserId,
      },
    });

    // Issuance is what confers certification: the status and its date are set
    // here, in the same act that creates the document and records `issuedBy`.
    if (candidate.status !== CandidateStatus.CERTIFIED) {
      await this.prisma.kbsCandidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.CERTIFIED, certifiedAt: new Date() },
      });
    }

    // Ensure KCA role is granted in Core
    await this.usersService.addRole(candidate.userId, RoleCode.KCA_CERTIFIED, adminUserId);

    // Send certificate email
    const user = await this.usersService.findById(candidate.userId);
    const lang = user.language || 'fr';
    await this.emailService.send({
      to: user.email,
      template: 'certificateIssued',
      lang,
      args: {
        firstName: user.firstName,
        kcaNumber,
        validUntil: DateTime.fromJSDate(certificate.validUntil).toLocaleString(DateTime.DATE_MED, {
          locale: lang,
        }),
      },
    });

    this.logger.log('Certificate issued %o', { candidateId, kcaNumber });
    return certificate;
  }

  // ----- Candidate: My Certificate ---------------------------

  async findByUserId(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
      include: {
        certificate: true,
        progress: { select: { passed: true } },
        exams: {
          where: { status: 'PASSED' },
          orderBy: { submittedAt: 'desc' },
          select: { score: true },
          take: 1,
        },
      },
    });

    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }

    if (!candidate.certificate) {
      return null;
    }

    const [user, settings] = await Promise.all([
      this.usersService.findById(candidate.userId),
      this.prisma.kbsSettings.findFirst({ select: { activeCourseId: true } }),
    ]);

    const modulesTotal = settings?.activeCourseId
      ? await this.prisma.kbsModule.count({
          where: { courseId: settings.activeCourseId },
        })
      : 0;
    const modulesCompleted = candidate.progress.filter((p) => p.passed).length;

    return {
      id: candidate.certificate.id,
      kcaNumber: candidate.certificate.kcaNumber,
      issueDate: candidate.certificate.issueDate,
      validUntil: candidate.certificate.validUntil,
      pdfUrl: candidate.certificate.pdfUrl,
      revokedAt: candidate.certificate.revokedAt,
      isValid: candidate.certificate.validUntil > new Date() && !candidate.certificate.revokedAt,
      candidate: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
      finalScore: candidate.exams[0]?.score ?? null,
      modulesCompleted,
      modulesTotal,
    };
  }

  // ----- Public: Verifiy Certificate ---------------------------

  /**
   * The public answer to "did KAMBRIQ issue this certificate, and does it still
   * stand?". Read anonymously by `/verify-certificate`, so every field here is a
   * statement made to a stranger about somebody's qualification.
   *
   * `status` is the verdict and the only field a reader should branch on.
   * `valid` is kept for existing callers and always agrees with it.
   *
   * **Revocation is read.** It was not: `revokedAt` was stored by
   * `revokeCertificate` and ignored here, so a certificate withdrawn by an
   * administrator answered `valid: true` until the day it expired - the
   * register said one thing and the public endpoint another. A revoked
   * certificate is REVOKED whatever its expiry date, because revocation is the
   * stronger and more recent statement.
   *
   * **It names nobody.** This used to return `candidateId` - the holder's user
   * UUID - to any anonymous caller, which identified a person to a stranger
   * without telling the stranger anything they could use. KCA numbers are a date
   * and four hex characters, so they can be enumerated; a name here would turn
   * this route into a directory of certified people. Whether the public page
   * should show a name, initials or nothing is a decision for the product and
   * its legal basis, not for this method - until it is taken, the answer is
   * about the certificate, not about the person.
   */
  async verifyCertificate(kcaNumber: string) {
    const certificate = await this.prisma.kbsCertificate.findUnique({
      where: { kcaNumber },
    });

    if (!certificate) {
      return {
        status: 'UNKNOWN' as CertificateVerificationStatus,
        valid: false,
        message: this.t('kbs.certificate.invalid'),
      };
    }

    const revoked = certificate.revokedAt !== null;
    const isExpired = certificate.validUntil < new Date();
    const status: CertificateVerificationStatus = revoked
      ? 'REVOKED'
      : isExpired
        ? 'EXPIRED'
        : 'VALID';

    return {
      status,
      valid: status === 'VALID',
      revoked,
      revokedAt: certificate.revokedAt,
      isExpired,
      kcaNumber: certificate.kcaNumber,
      issueDate: certificate.issueDate,
      validUntil: certificate.validUntil,
    };
  }

  // ----- Admin: Revoke Certificate ---------------------------

  async revokeCertificate(candidateId: string, adminUserId: string, dto: RevokeCertificateDto) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { id: candidateId },
      include: { certificate: true },
    });

    if (!candidate) {
      throw new NotFoundException(
        this.t('kbs.certificate.candidateNotFound', undefined, {
          id: candidateId,
        }),
      );
    }

    if (!candidate.certificate) {
      throw new NotFoundException(this.t('kbs.certificate.notFound', 'en'));
    }

    if (candidate.certificate.revokedAt) {
      throw new ConflictException(this.t('kbs.certificate.alreadyRevoked', 'en'));
    }

    const revoked = await this.prisma.kbsCertificate.update({
      where: { id: candidate.certificate.id },
      data: {
        revokedAt: new Date(),
        revokedBy: adminUserId,
        revokeReason: dto.reason,
      },
    });

    // Downgrade candidate status back to EXAM_PENDING so admin can re-certify
    await this.prisma.kbsCandidate.update({
      where: { id: candidateId },
      data: { status: CandidateStatus.EXAM_PENDING, certifiedAt: null },
    });

    // Remove KCA_CERTIFIED role from the user in Core
    await this.usersService.removeRole(candidate.userId, RoleCode.KCA_CERTIFIED);

    // I16 - revocation removes the power to act, exactly as suspension does: AGENT
    // goes, the KamnetAgent record, its history and its commissions stay. It used
    // to leave AGENT in place, so an agent whose certificate was withdrawn kept
    // selling. CLIENT is held in its own right and is untouched.
    await this.usersService.removeRole(candidate.userId, RoleCode.AGENT);

    this.logger.log('Certificate revoked %o', {
      candidateId,
      kcaNumber: candidate.certificate.kcaNumber,
      revokedBy: adminUserId,
      reason: dto.reason,
    });

    return revoked;
  }

  // ----- Scheduled: Expiry ---------------------------

  /**
   * I15 - expiry withdraws KCA_CERTIFIED, as revocation does.
   *
   * The role is a projection of the certificate. Nothing used to happen when a
   * certificate expired: the role stayed on the account, and the platform went
   * on treating as certified somebody `/verify-certificate` answered "expiré"
   * for. Run daily by `KbsCertificateExpiryScheduler`.
   *
   * Every expired certificate is swept, not only those expired since the last
   * run: the role lives in the core database, so there is no join to narrow the
   * set, and `removeRole` on a user who no longer holds the role deletes
   * nothing. A missed day is therefore healed by the next run. The candidate's
   * status is left as it is: `isUserCertified` already answers no for an
   * expired certificate.
   */
  async withdrawExpiredCertifications(now: Date = new Date()): Promise<number> {
    const expired = await this.prisma.kbsCertificate.findMany({
      where: { validUntil: { lt: now } },
      select: { kcaNumber: true, candidate: { select: { userId: true } } },
    });

    for (const certificate of expired) {
      await this.usersService.removeRole(certificate.candidate.userId, RoleCode.KCA_CERTIFIED);
    }

    this.logger.log('Expired certifications withdrawn %o', { count: expired.length });
    return expired.length;
  }

  // ----- Admin: List All Certificates---------------

  async findAll(query: PaginationQuery) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const [certificates, total] = await this.prisma.$transaction([
      this.prisma.kbsCertificate.findMany({
        skip,
        take: limit,
        orderBy: { [sort]: order },
        include: {
          candidate: {
            select: {
              id: true,
              userId: true,
            },
          },
        },
      }),
      this.prisma.kbsCertificate.count(),
    ]);

    const users = await this.usersService.findManyByIds(
      certificates.map((c) => c.candidate.userId),
    );
    const userById = new Map(users.map((u) => [u.id, u]));

    const data = certificates.map((c) => {
      const u = userById.get(c.candidate.userId);
      return {
        id: c.id,
        kcaNumber: c.kcaNumber,
        issueDate: c.issueDate,
        validUntil: c.validUntil,
        revokedAt: c.revokedAt,
        candidate: {
          id: c.candidate.id,
          firstName: u?.firstName ?? null,
          lastName: u?.lastName ?? null,
          email: u?.email ?? null,
        },
      };
    });

    return buildPaginatedResponse(data, total, page, limit);
  }

  // ----- Private Helpers ---------------------------

  /**
   * Generates a unique KCA number.
   * Format: KCA-YYYYMMDD-XXXX (4 random alphanumeric chars).
   * Retries up to 10 times on collision (DB unique constraint).
   */
  private async generateKcaNumber(): Promise<string> {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    for (let attempt = 0; attempt < 10; attempt++) {
      const kcaNumber = `KCA-${datePart}-${this.randomSuffix(4)}`;
      const exists = await this.prisma.kbsCertificate.findUnique({
        where: { kcaNumber },
      });
      if (!exists) return kcaNumber;
    }

    throw new Error(
      this.t('kbs.certificate.numberGenerationFailed', DEFAULT_LANGUAGE, { attempts: 10 }),
    );
  }

  private randomSuffix(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(randomBytes(length), (b) => charset[b % charset.length]).join('');
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
