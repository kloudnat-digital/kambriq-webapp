import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { I18nService } from 'nestjs-i18n';
import {
  CommissionFilterDto,
  CreateCommissionDto,
  UpdateCommissionStatusDto,
} from '../dto/kamnet.dto';
import {
  buildPaginatedResponse,
  KAMNET_VALID_COMMISSION_TRANSITIONS,
  KamnetCommissionStatus,
  PaginationQuery,
} from '@kambriq/common';

/**
 * In MVP, commission records are created manually by admins.
 * Auto-calculation from sales comes in v2
 *
 * Commision levels:
 * - Level 0: DA (Direct Agent) -> The agent who made the sale
 * - Level 1: N1 sponsor -> Parent
 * - Level 2: N2 sponsor -> Grandparent
 * - Level 3: N3 sponsor -> Great-grandparent
 */
@Injectable()
export class KamnetCommissionsService {
  private readonly logger = new Logger(KamnetCommissionsService.name);

  constructor(
    private readonly prisma: KamnetPrismaService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Admin: Create Commission Record -----
  async create(dto: CreateCommissionDto) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { id: dto.agentId },
    });

    if (!agent) {
      throw new NotFoundException(this.t('kamnet.agent.notFound'));
    }

    const commission = await this.prisma.kamnetCommission.create({
      data: {
        agentId: dto.agentId,
        landId: dto.landId as string,
        reservationId: dto.reservationId as string,
        level: dto.level,
        pv: dto.pv,
        tpc: dto.tpc,
        amount: dto.amount,
        status: KamnetCommissionStatus.PENDING,
      },
    });

    this.logger.log('Commission record created', {
      commissionId: commission.id,
      agentId: dto.agentId,
      amount: dto.amount,
      level: dto.level,
    });

    return commission;
  }

  // ----- Admin: Update Commission Status -----
  async updateStatus(commissionId: string, dto: UpdateCommissionStatusDto) {
    const commission = await this.findByIdOrThrow(commissionId);

    const allowed = KAMNET_VALID_COMMISSION_TRANSITIONS[commission.status] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        this.t('kamnet.commission.invalidStatusTransition', undefined, {
          from: commission.status,
          to: dto.status,
        }),
      );
    }

    const updated = await this.prisma.kamnetCommission.update({
      where: { id: commissionId },
      data: {
        status: dto.status,
        ...(dto.status === KamnetCommissionStatus.PAID && {
          paidAt: new Date(),
        }),
      },
    });

    this.logger.log('Commission status updated', {
      commissionId,
      from: commission.status,
      to: dto.status,
    });

    return updated;
  }

  // ----- Agent: Get My Commissions ----- //
  async findMyCommissions(agentId: string, query: PaginationQuery, filters?: CommissionFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { agentId };
    if (filters?.status) where.status = filters.status;

    const [commissions, total] = await this.prisma.$transaction([
      this.prisma.kamnetCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
      }),
      this.prisma.kamnetCommission.count({ where }),
    ]);

    return buildPaginatedResponse(commissions, total, page, limit);
  }

  // ----- Admin: Get All Commissions ----- //
  async findAll(query: PaginationQuery, filters?: CommissionFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters?.agentId) where.agentId = filters.agentId;
    if (filters?.status) where.status = filters.status;

    const [commissions, total] = await this.prisma.$transaction([
      this.prisma.kamnetCommission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          agent: {
            select: { id: true, agentCode: true, userId: true },
          },
        },
      }),
      this.prisma.kamnetCommission.count({ where }),
    ]);

    return buildPaginatedResponse(commissions, total, page, limit);
  }

  // ----- Agent: Commission Summary ----- //
  /** Aggregate totals for dashboard display */
  async getSummary(agentId: string) {
    const [pending, validated, paid] = await this.prisma.$transaction([
      this.prisma.kamnetCommission.aggregate({
        where: { agentId, status: KamnetCommissionStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.kamnetCommission.aggregate({
        where: { agentId, status: KamnetCommissionStatus.VALIDATED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.kamnetCommission.aggregate({
        where: { agentId, status: KamnetCommissionStatus.PAID },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      pending: {
        count: pending._count,
        totalAmount: pending._sum.amount || 0,
      },
      validated: {
        count: validated._count,
        totalAmount: validated._sum.amount || 0,
      },
      paid: {
        count: paid._count,
        totalAmount: paid._sum.amount || 0,
      },
    };
  }

  // ----- Private Helpers -----//
  private async findByIdOrThrow(commissionId: string) {
    const commission = await this.prisma.kamnetCommission.findUnique({
      where: { id: commissionId },
    });
    if (!commission) {
      throw new NotFoundException(this.t('kamnet.commission.notFound'));
    }
    return commission;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
