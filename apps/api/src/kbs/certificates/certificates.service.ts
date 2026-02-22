import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { KbsPrismaService } from '../prisma/kbs-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { IssueCertificateDto } from './dto/certificate.dto';
import {
  buildPaginatedResponse,
  CandidateStatus,
  EmailService,
  PaginationQuery,
  RoleCode,
} from '@kambriq/common';
import { I18nService } from 'nestjs-i18n';
import { DateTime } from 'luxon';

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
  async issueCertificate(
    candidateId: string,
    adminUserId: string,
    dto?: IssueCertificateDto,
  ) {
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

    // Requirement: status must be CERTIFIED or has passed exam
    const passedExam = await this.prisma.kbsCandidateProgress.findFirst({
      where: {
        candidateId,
        passed: true,
      },
    });

    if (candidate.status !== CandidateStatus.CERTIFIED && !passedExam) {
      this.logger.warn(
        'Attempt to issue certificate failed - candidate has not passed final exam',
        { candidateId, status: candidate.status },
      );
      throw new NotFoundException(this.t('kbs.certificate.notPassed', 'en'));
    }

    // Prevent duplicate certificates
    if (candidate.certificate) {
      throw new ConflictException(
        this.t('kbs.certificate.alreadyIssued', 'en', {
          kcaNumber: candidate.certificate.kcaNumber,
        }),
      );
    }

    // Generate unique KCA number: KCA-YYYYMMDD-XXXX
    const kcaNumber = this.generateKcaNumber();

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

    //Ensure candidate status is updated to CERTIFIED if not already
    if (candidate.status !== CandidateStatus.CERTIFIED) {
      await this.prisma.kbsCandidate.update({
        where: { id: candidateId },
        data: { status: CandidateStatus.CERTIFIED },
      });
    }

    // Ensure KCA role is granted in Core
    await this.usersService.addRole(
      candidate.userId,
      RoleCode.KCA_CERTIFIED,
      adminUserId,
    );

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
        validUntil: DateTime.fromJSDate(certificate.validUntil).toLocaleString(
          DateTime.DATE_MED,
          { locale: lang },
        ),
      },
    });

    this.logger.log('Certificate issued', { candidateId, kcaNumber });
    return certificate;
  }

  // ----- Candidate: My Certificate ---------------------------

  async findByUserId(userId: string) {
    const candidate = await this.prisma.kbsCandidate.findUnique({
      where: { userId },
      include: { certificate: true },
    });

    if (!candidate) {
      throw new NotFoundException(this.t('kbs.enrollment.notEnrolled'));
    }

    if (!candidate.certificate) {
      return null;
    }

    return {
      kcaNumber: candidate.certificate.kcaNumber,
      issueDate: candidate.certificate.issueDate,
      validUntil: candidate.certificate.validUntil,
      isValid: candidate.certificate.validUntil > new Date(),
      pdfUrl: candidate.certificate.pdfUrl,
    };
  }

  // ----- Public: Verifiy Certificate ---------------------------

  async verifyCertificate(kcaNumber: string) {
    const certificate = await this.prisma.kbsCertificate.findUnique({
      where: { kcaNumber },
      include: {
        candidate: { select: { userId: true, certifiedAt: true } },
      },
    });

    if (!certificate) {
      return {
        valid: false,
        message: this.t('kbs.certificate.invalid'),
      };
    }

    const isExpired = certificate.validUntil < new Date();

    return {
      isExpired,
      valid: !isExpired,
      kcaNumber: certificate.kcaNumber,
      issueDate: certificate.issueDate,
      validUntil: certificate.validUntil,
      candidateId: certificate.candidate.userId,
    };
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
              userId: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.kbsCertificate.count(),
    ]);

    return buildPaginatedResponse(certificates, total, page, limit);
  }

  // ----- Private Helpers ---------------------------
  private generateKcaNumber(): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `KCA-${datePart}-${randomPart}`;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
