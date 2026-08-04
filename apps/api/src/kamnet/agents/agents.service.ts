import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';
import {
  buildPaginatedResponse,
  EmailService,
  KAMNET_PROMOTION_THRESHOLDS,
  KamnetAgentTier,
  PaginationQuery,
  RedisService,
} from '@kambriq/common';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { AgentFilterDto, UpdateAgentProfileDto, UpdateAgentStatusDto } from '../dto/kamnet.dto';

@Injectable()
export class KamnetAgentsService {
  private readonly logger = new Logger(KamnetAgentsService.name);

  private static agentCacheKey = (userId: string) => `kamnet:agent:userId:${userId}`;
  private static readonly AGENT_CACHE_TTL = 60; // seconds

  constructor(
    private readonly prisma: KamnetPrismaService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    private readonly i18n: I18nService,
    private readonly redis: RedisService,
  ) {}

  // ----- My Profile ----- //
  async getMyProfile(userId: string) {
    const agent = await this.findByUserId(userId);
    const user = await this.usersService.findById(userId);

    return {
      ...agent,
      user: {
        email: user.email,
        phone: user.phone,
        lastName: user.lastName,
        firstName: user.firstName,
        address: user.profile?.address ?? null,
        avatarUrl: user.profile?.avatarUrl ?? null,
        country: user.profile?.country ?? null,
        city: user.profile?.city ?? null,
      },
    };
  }

  // ----- Update My Profile ----- //
  async updateMyProfile(userId: string, dto: UpdateAgentProfileDto) {
    const agent = await this.findByUserId(userId);

    if (agent.suspendedAt) {
      throw new ForbiddenException(this.t('kamnet.agent.suspended'));
    }

    const userFields: Record<string, unknown> = {};
    const agentFields: Record<string, unknown> = {};

    if (dto.bio !== undefined) agentFields.bio = dto.bio;

    if (dto.firstName !== undefined) userFields.firstName = dto.firstName;
    if (dto.lastName !== undefined) userFields.lastName = dto.lastName;
    if (dto.phone !== undefined) userFields.phone = dto.phone;
    if (dto.language !== undefined) userFields.language = dto.language;
    if (dto.avatarUrl !== undefined) userFields.avatarUrl = dto.avatarUrl;
    if (dto.address !== undefined) userFields.address = dto.address;
    if (dto.city !== undefined) userFields.city = dto.city;
    if (dto.country !== undefined) userFields.country = dto.country;

    if (Object.keys(userFields).length > 0) {
      await this.usersService.updateMe(agent.userId, userFields);
    }

    if (Object.keys(agentFields).length > 0) {
      await this.prisma.kamnetAgent.update({
        where: { id: agent.id },
        data: agentFields,
      });
    }

    return this.getMyProfile(userId);
  }

  // ----- Get Agent by ID ----- //
  async findById(agentId: string) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { id: agentId },
      include: {
        sponsor: {
          select: { id: true, agentCode: true, userId: true },
        },
        _count: {
          select: { referrals: true },
        },
      },
    });

    if (!agent) {
      throw new NotFoundException(this.t('kamnet.agent.notFound'));
    }

    const user = await this.usersService.findById(agent.userId);

    return {
      id: agent.id,
      bio: agent.bio,
      tier: agent.tier,
      agentCode: agent.agentCode,
      salesCount: agent.salesCount,
      referralCount: agent._count.referrals,
      sponsor: agent.sponsor
        ? {
            id: agent.sponsor.id,
            agentCode: agent.sponsor.agentCode,
          }
        : null,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        country: user.profile?.country ?? null,
        city: user.profile?.city ?? null,
      },
      createdAt: agent.createdAt.toISOString(),
    };
  }

  // ----- Get Agent by User ID ----- //
  // Cached in Redis for AGENT_CACHE_TTL seconds to avoid a DB round-trip
  // on every agent-scoped endpoint call. Cache is invalidated on suspend/reactivate.
  async findByUserId(userId: string) {
    const cacheKey = KamnetAgentsService.agentCacheKey(userId);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { userId },
    });

    if (!agent) {
      throw new NotFoundException(this.t('kamnet.agent.notFound'));
    }

    await this.redis.set(cacheKey, JSON.stringify(agent), KamnetAgentsService.AGENT_CACHE_TTL);

    return agent;
  }

  // ----- Auto Promotion Check ----- //
  /**
   * Called after a sale is recorded. Check if agent qualifies
   * for a higher status based on sales and referrals thresholds
   */
  async checkPromotion(agentId: string) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { id: agentId },
      include: {
        _count: { select: { referrals: true } },
      },
    });

    if (!agent || agent.suspendedAt) {
      this.logger.warn('Promotion check: Agent not found or suspended', {
        agentId,
      });
      return null;
    }

    let newTier: KamnetAgentTier | null = null;

    // JUNIOR -> CONFIRMED: 5 completed sales
    if (
      agent.tier === KamnetAgentTier.JUNIOR &&
      agent.salesCount >= KAMNET_PROMOTION_THRESHOLDS.CONFIRMED_SALES
    ) {
      newTier = KamnetAgentTier.CONFIRMED;
    }

    // CONFIRMED -> MANAGER: 10+ completed sales + 10+ referrals
    if (
      agent.tier === KamnetAgentTier.CONFIRMED &&
      agent.salesCount >= KAMNET_PROMOTION_THRESHOLDS.MANAGER_SALES &&
      agent._count.referrals >= KAMNET_PROMOTION_THRESHOLDS.MANAGER_REFERRALS
    ) {
      newTier = KamnetAgentTier.MANAGER;
    }

    if (!newTier) return null;

    const update = await this.prisma.kamnetAgent.update({
      where: { id: agentId },
      data: { tier: newTier },
    });

    const user = await this.usersService.findById(agent.userId);

    this.logger.log('Agent promoted', {
      agentId,
      from: agent.tier,
      to: newTier,
    });

    await this.emailService.sendUpdate(
      {
        to: user.email,
        template: 'agentPromotion',
        lang: user.language || 'fr',
        args: {
          firstName: user.firstName || user.email,
          newTier,
        },
      },
      user.profile,
    );

    return update;
  }

  // ----- Admin: Update Agent Status ----- //
  /**
   * Manual status override (e.g. promote or correct status)
   */
  async update(agentId: string, dto: UpdateAgentStatusDto) {
    const agent = await this.findByIdOrThrow(agentId);

    const update = await this.prisma.kamnetAgent.update({
      where: { id: agentId },
      data: { tier: dto.tier },
    });

    this.logger.log('Admin updated agent tier', {
      agentId,
      from: agent.tier,
      to: dto.tier,
    });

    return update;
  }

  // ----- Admin: Suspend Agent ----- //
  async suspend(agentId: string, adminUserId: string) {
    const agent = await this.findByIdOrThrow(agentId);

    if (agent.suspendedAt) {
      throw new ForbiddenException(this.t('kamnet.agent.alreadySuspended'));
    }

    const update = await this.prisma.kamnetAgent.update({
      where: { id: agentId },
      data: { suspendedAt: new Date(), suspendedBy: adminUserId },
    });

    await this.redis.del(KamnetAgentsService.agentCacheKey(agent.userId));

    // Notify agent by email
    const user = await this.usersService.findById(agent.userId);
    await this.emailService.send({
      to: user.email,
      template: 'agentSuspended',
      lang: user.language || 'fr',
      args: { firstName: user.firstName || user.email },
    });

    this.logger.warn('Agent suspended', {
      agentId,
      adminUserId,
    });

    return update;
  }

  // ----- Admin: Reactivate Agent ----- //
  async reactivate(agentId: string, adminUserId: string) {
    const agent = await this.findByIdOrThrow(agentId);

    if (!agent.suspendedAt) {
      throw new ConflictException(this.t('kamnet.agent.notSuspended'));
    }

    const update = await this.prisma.kamnetAgent.update({
      where: { id: agentId },
      data: { suspendedAt: null, suspendedBy: null },
    });

    await this.redis.del(KamnetAgentsService.agentCacheKey(agent.userId));

    // Notify agent by email
    const user = await this.usersService.findById(agent.userId);
    await this.emailService.send({
      to: user.email,
      template: 'agentReactivated',
      lang: user.language || 'fr',
      args: { firstName: user.firstName || user.email },
    });

    this.logger.log('Agent reactivated', {
      agentId,
      adminUserId,
    });

    return update;
  }

  // ----- Admin: List Agents ----- //
  async findAll(query: PaginationQuery, filters?: AgentFilterDto) {
    const { page, limit, sort, order } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filters?.tier) where.tier = filters.tier;
    if (filters?.country) {
      where.country = {
        contains: filters.country,
        mode: 'insensitive',
      };
    }
    if (filters?.search) {
      where.OR = [
        {
          agentCode: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          kcaNumber: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [agents, total] = await this.prisma.$transaction([
      this.prisma.kamnetAgent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sort || 'createdAt']: order || 'desc' },
        include: {
          _count: {
            select: { referrals: true },
          },
        },
      }),
      this.prisma.kamnetAgent.count({ where }),
    ]);

    return buildPaginatedResponse(agents, total, page, limit);
  }

  // ----- Increment sales count ----- //
  /**
   * Called when a reservation is marked as COMPLETED
   */
  async incrementSales(agentId: string) {
    return this.prisma.kamnetAgent.update({
      where: { id: agentId },
      data: { salesCount: { increment: 1 } },
    });
  }

  // ----- Private Helpers ----- //

  private async findByIdOrThrow(id: string) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { id },
    });

    if (!agent) {
      throw new NotFoundException(this.t('kamnet.agent.notFound'));
    }

    return agent;
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>) {
    return this.i18n.translate(key, { lang, args });
  }
}
