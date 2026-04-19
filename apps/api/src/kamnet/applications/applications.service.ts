import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { KbsCertificatesService } from '../../kbs/certificates/certificates.service';
import { I18nService } from 'nestjs-i18n';
import {
  buildPaginatedResponse,
  DEFAULT_LANGUAGE,
  EmailService,
  KamnetAgentTier,
  KamnetApplicationStatus,
  PaginationQuery,
  RoleCode,
} from '@kambriq/common';
import {
  ApplicationFilterDto,
  ReviewApplicationDto,
  SubmitApplicationDto,
} from '../dto/kamnet.dto';

/**
 * Handles the lifecycle of a KAMNET membership application:
 *
 * 1. KCA-certified user submits an application
 * 2. Admin reviews and approves or rejects
 * 3. On approval -> KamnetAgent record is created
 *
 * Cross-module interactions:
 * - Calls KbsCertificatesService to verify KCA certification
 * - Calls UsersService to grant AGENT role and look up user info
 */

@Injectable()
export class KamnetApplicationsService {
  private readonly logger = new Logger(KamnetApplicationsService.name);

  constructor(
    private readonly prisma: KamnetPrismaService,
    private readonly usersService: UsersService,
    private readonly certificatesService: KbsCertificatesService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Submit Application----- //
  async submit(userId: string, dto: SubmitApplicationDto) {
    const existing = await this.prisma.kamnetApplication.findUnique({
      where: { userId },
    });

    if (existing) {
      throw new ConflictException(this.t('kamnet.application.alreadyExists'));
    }

    const existingAgent = await this.prisma.kamnetAgent.findUnique({
      where: { userId },
    });

    if (existingAgent) {
      throw new ConflictException(this.t('kamnet.agent.alreadyExists'));
    }

    const kcaResult = await this.certificatesService.verifyCertificate(dto.kcaNumber);

    if (!kcaResult.valid) {
      throw new ForbiddenException(this.t('kamnet.application.invalidKCA'));
    }

    if (dto.sponsorCode) {
      const sponsor = await this.prisma.kamnetAgent.findUnique({
        where: { agentCode: dto.sponsorCode },
      });

      if (!sponsor) {
        throw new NotFoundException(
          this.t('kamnet.application.sponsorNotFound', undefined, {
            code: dto.sponsorCode,
          }),
        );
      }
    }

    const application = await this.prisma.kamnetApplication.create({
      data: {
        userId,
        kcaNumber: dto.kcaNumber,
        sponsorCode: dto.sponsorCode || null,
        motivation: dto.motivation || null,
        status: KamnetApplicationStatus.PENDING,
      },
    });

    const user = await this.usersService.findById(userId);
    await this.emailService.send({
      to: user.email,
      template: 'applicationSubmitted',
      lang: user.language || 'fr',
      args: { firstName: user.firstName || user.email },
    });

    this.logger.log('New KAMNET application submitted', {
      userId,
      kcaNumber: dto.kcaNumber,
    });

    return application;
  }

  // ----- Get My Application ----- //
  async getMyApplication(userId: string) {
    const application = await this.prisma.kamnetApplication.findUnique({
      where: { userId },
    });

    if (!application) {
      throw new NotFoundException(this.t('kamnet.application.notFound'));
    }

    return application;
  }

  // ----- Admin: Review Application ----- //
  async review(applicationId: string, adminUserId: string, dto: ReviewApplicationDto) {
    const application = await this.prisma.kamnetApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new NotFoundException(this.t('kamnet.application.notFound'));
    }

    if (application.status !== KamnetApplicationStatus.PENDING) {
      throw new ConflictException(this.t('kamnet.application.alreadyReviewed'));
    }

    const update = await this.prisma.kamnetApplication.update({
      where: { id: applicationId },
      data: {
        status: dto.status,
        reviewedBy: adminUserId,
        reviewNote: dto.reviewNote || null,
        reviewedAt: new Date(),
      },
    });

    const user = await this.usersService.findById(application.userId);
    const lang = user.language || 'fr';

    if (dto.status === KamnetApplicationStatus.APPROVED) {
      const agentCode = await this.generateAgentCode();

      let sponsorId: string | null = null;
      if (application.sponsorCode) {
        const sponsor = await this.prisma.kamnetAgent.findUnique({
          where: { agentCode: application.sponsorCode },
        });

        sponsorId = sponsor?.id || null;
      }

      const agent = await this.prisma.kamnetAgent.create({
        data: {
          userId: application.userId,
          kcaNumber: application.kcaNumber,
          agentCode,
          tier: KamnetAgentTier.JUNIOR,
          sponsorId,
        },
      });

      await this.usersService.addRole(application.userId, RoleCode.AGENT, adminUserId);

      await this.emailService.send({
        to: user.email,
        template: 'applicationApproved',
        lang,
        args: {
          firsName: user.firstName || user.email,
          agentCode,
        },
      });

      this.logger.log('KAMNET application approved', {
        applicationId,
        agentId: agent.id,
        agentCode,
        sponsorId,
      });

      return { application: update, agent };
    }

    await this.emailService.send({
      to: user.email,
      template: 'applicationRejected',
      lang,
      args: {
        firstName: user.firstName || user.email,
        reason: dto.reviewNote || '',
      },
    });
  }

  // ----- Admin: List Applications ----- //
  async findAll(query: PaginationQuery, filters?: ApplicationFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.search) {
      where.OR = [
        {
          kcaNumber: {
            contains: filters.search,
            mode: 'insensitive',
          },
          userId: {
            contains: filters.search,
          },
        },
      ];
    }

    const [applications, total] = await this.prisma.$transaction([
      this.prisma.kamnetApplication.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sort || 'createdAt']: order || 'desc',
        },
      }),
      this.prisma.kamnetApplication.count({ where }),
    ]);

    return buildPaginatedResponse(applications, total, page, limit);
  }

  // ----- Private Helpers ----- //

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }

  /**
   * Generates a unique AGENT number.
   * Format: AGT-YYYY-XXXX (4 random alphanumeric chars).
   * Retries up to 10 times on collision (DB unique constraint).
   */
  private async generateAgentCode(): Promise<string> {
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 10; attempt++) {
      const agentCode = `AGT-${year}-${this.randomSuffix(4)}`;
      const exists = await this.prisma.kamnetAgent.findUnique({
        where: { agentCode },
      });
      if (!exists) return agentCode;
    }

    throw new Error(
      this.t('kamnet.agent.codeGenerationFailed', DEFAULT_LANGUAGE, { attempts: 10 }),
    );
  }

  private randomSuffix(length: number): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(randomBytes(length), (b) => charset[b % charset.length]).join('');
  }
}
