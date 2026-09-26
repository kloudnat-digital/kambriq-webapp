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
import { KbsCandidatesService } from '../../kbs/candidates/candidates.service';
import { I18nService } from 'nestjs-i18n';
import { ConfigService } from '@nestjs/config';
import {
  buildPaginatedResponse,
  DEFAULT_LANGUAGE,
  EmailService,
  formatHumanDateTime,
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
 * - Queries KbsCandidatesService to verify the applicant's active certification.
 * - Calls UsersService to grant the AGENT role and retrieve user information.
 */

@Injectable()
export class KamnetApplicationsService {
  private readonly logger = new Logger(KamnetApplicationsService.name);

  constructor(
    private readonly prisma: KamnetPrismaService,
    private readonly usersService: UsersService,
    private readonly candidatesService: KbsCandidatesService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
    private readonly config: ConfigService,
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

    /**
     * Verifies that the applicant holds an active certificate matching the provided KCA number.
     */
    const certificate = await this.candidatesService.findActiveCertificate(userId);
    if (!certificate || certificate.kcaNumber !== dto.kcaNumber) {
      throw new ForbiddenException(this.t('kamnet.application.invalidKca'));
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

    this.logger.log('New KAMNET application submitted %o', {
      userId,
      kcaNumber: dto.kcaNumber,
    });

    // P5: stored first - that is the success - then announced. A failed mail is
    // logged loudly and never fails the request: the application exists, and an
    // error here would send the applicant back to a 409 (L1's rule).
    await this.trySend(application.id, 'applicant confirmation', () =>
      this.emailService.send({
        to: user.email,
        template: 'applicationSubmitted',
        lang: user.language || 'fr',
        args: { firstName: user.firstName || user.email },
      }),
    );

    const inbox = this.config.get<string>('CONTACT_INBOX_EMAIL');
    if (!inbox) {
      this.logger.error(
        `KAMNET application ${application.id} stored but not announced: CONTACT_INBOX_EMAIL is not set.`,
      );
    } else {
      const lang =
        this.config.get<string>('CONTACT_BACKOFFICE_LOCALE', 'fr') === 'en' ? 'en' : 'fr';
      const none = this.t('kamnet.application.none', lang);
      await this.trySend(application.id, 'back-office notification', () =>
        this.emailService.send({
          to: inbox,
          template: 'kamnetApplicationNotification',
          lang,
          args: {
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
            email: user.email,
            phone: user.phone || none,
            kcaNumber: dto.kcaNumber,
            sponsorCode: dto.sponsorCode || none,
            motivation: dto.motivation || none,
            receivedAt: formatHumanDateTime(
              application.createdAt ?? new Date(),
              lang === 'en' ? 'en-GB' : 'fr-FR',
            ),
          },
        }),
      );
    }

    return application;
  }

  /** A mail that fails after the application is stored is an error in the log, never a failed request. */
  private async trySend(applicationId: string, what: string, send: () => Promise<unknown>) {
    try {
      await send();
    } catch (error) {
      this.logger.error(
        `KAMNET application ${applicationId}: the ${what} could not be sent (${
          error instanceof Error ? error.message : String(error)
        }).`,
      );
    }
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
      throw new ConflictException(this.t('kamnet.application.notPending'));
    }

    // Ensure the applicant's certification is still active before approval.
    if (
      dto.status === KamnetApplicationStatus.APPROVED &&
      !(await this.candidatesService.isUserCertified(application.userId))
    ) {
      throw new ForbiddenException(this.t('kamnet.application.invalidKca'));
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

      // Grant CLIENT role independently before AGENT role to ensure access
      // to personal purchases is maintained even if AGENT status is revoked.
      await this.usersService.addRole(application.userId, RoleCode.CLIENT, adminUserId);
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

      this.logger.log('KAMNET application approved %o', {
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
