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
  RoleCode,
} from '@kambriq/common';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { UsersService } from '../../core/users/users.service';
import { KbsCandidatesService } from '../../kbs/candidates/candidates.service';
import { toPublicDirectoryEntry, type PublicDirectoryEntry } from './public-listing';
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
    private readonly candidatesService: KbsCandidatesService,
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

  // ----- P11: the public directory ----- //

  /**
   * Every agent who may appear in the public directory, in the shape a
   * stranger is shown.
   *
   * ---------------------------------------------------------------------------
   * The WHERE is an optimisation; the rule is `toPublicDirectoryEntry`
   * ---------------------------------------------------------------------------
   * Narrowing on consent and suspension in the database keeps the core and kbs
   * round-trips down, but the decision is taken again in the projection for
   * every row that survives. Two places that must agree would be a defect; a
   * filter that can only ever be *stricter* than the rule it precedes is not.
   * `kamnet-public-directory.dbspec.ts` proves the rule without this WHERE at
   * all, which is why the rule is the thing under test.
   *
   * ---------------------------------------------------------------------------
   * Read straight from Prisma, never through `findByUserId`
   * ---------------------------------------------------------------------------
   * `findByUserId` caches the agent row in Redis for 60 seconds and is
   * invalidated on suspend and reactivate only. Reading consent through it
   * would leave a withdrawn agent listed for up to a minute, and P11 requires
   * withdrawal to take effect immediately. `setPublicListingConsent` below
   * deletes the same key anyway, so the two defences do not depend on each
   * other.
   */
  async listPublicDirectory(): Promise<PublicDirectoryEntry[]> {
    const agents = await this.prisma.kamnetAgent.findMany({
      where: { publicListingConsentAt: { not: null }, suspendedAt: null },
      select: { userId: true, publicListingConsentAt: true, suspendedAt: true },
      orderBy: { publicListingConsentAt: 'asc' },
    });

    if (agents.length === 0) return [];

    // One query for every name, rather than one per agent: see
    // `UsersService.findDirectoryUsers` for why `findById` is wrong here.
    const users = await this.usersService.findDirectoryUsers(agents.map((a) => a.userId));
    const byUserId = new Map(users.map((user) => [user.id, user]));

    const entries = await Promise.all(
      agents.map(async (agent) => {
        const certificate = await this.candidatesService.findNewestCertificateFacts(agent.userId);
        return toPublicDirectoryEntry(agent, byUserId.get(agent.userId) ?? null, certificate);
      }),
    );

    return entries.filter((entry): entry is PublicDirectoryEntry => entry !== null);
  }

  /**
   * Manages explicit agent consent for public directory listing.
   * Explicitly decoupled from standard profile updates to ensure deliberate action.
   * Clears the Redis cache immediately upon withdrawal to enforce instantaneous delisting.
   */
  async setPublicListingConsent(userId: string, consented: boolean) {
    const agent = await this.findByIdOrThrowByUserId(userId);

    if (agent.suspendedAt && consented) {
      throw new ForbiddenException(this.t('kamnet.agent.suspended'));
    }

    const updated = await this.prisma.kamnetAgent.update({
      where: { id: agent.id },
      data: { publicListingConsentAt: consented ? new Date() : null },
      select: { publicListingConsentAt: true },
    });

    await this.redis.del(KamnetAgentsService.agentCacheKey(userId));

    this.logger.log('Agent public listing consent %o', {
      userId,
      listed: updated.publicListingConsentAt !== null,
    });

    return { publicListingConsentAt: updated.publicListingConsentAt };
  }

  /** The agent row for a user, uncached, or a 404. */
  private async findByIdOrThrowByUserId(userId: string) {
    const agent = await this.prisma.kamnetAgent.findUnique({ where: { userId } });
    if (!agent) throw new NotFoundException(this.t('kamnet.agent.notFound'));
    return agent;
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
   * Checks and processes agent tier promotion based on completed sales count.
   * Triggered automatically after a successful sale record.
   */
  async checkPromotion(agentId: string) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent || agent.suspendedAt) {
      this.logger.warn('Promotion check: Agent not found or suspended %o', {
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

    // CONFIRMED -> MANAGER: 10 completed sales
    if (
      agent.tier === KamnetAgentTier.CONFIRMED &&
      agent.salesCount >= KAMNET_PROMOTION_THRESHOLDS.MANAGER_SALES
    ) {
      newTier = KamnetAgentTier.MANAGER;
    }

    if (!newTier) return null;

    const update = await this.prisma.kamnetAgent.update({
      where: { id: agentId },
      data: { tier: newTier },
    });

    const user = await this.usersService.findById(agent.userId);

    this.logger.log('Agent promoted %o', {
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

    this.logger.log('Admin updated agent tier %o', {
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

    /**
     * Suspension revokes the AGENT role, restricting agent-specific actions.
     * The CLIENT role is retained, maintaining access to personal purchases.
     * Commission and history records remain accessible via ownership.
     */
    await this.usersService.removeRole(agent.userId, RoleCode.AGENT);

    await this.redis.del(KamnetAgentsService.agentCacheKey(agent.userId));

    // Notify agent by email
    const user = await this.usersService.findById(agent.userId);
    await this.emailService.send({
      to: user.email,
      template: 'agentSuspended',
      lang: user.language || 'fr',
      args: { firstName: user.firstName || user.email },
    });

    this.logger.warn('Agent suspended %o', {
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

    // Re-grant the AGENT role only if the user maintains an active certification.
    if (await this.candidatesService.isUserCertified(agent.userId)) {
      await this.usersService.addRole(agent.userId, RoleCode.AGENT, adminUserId);
    } else {
      this.logger.warn('Agent reactivated without AGENT: no active certificate %o', {
        agentId,
        adminUserId,
      });
    }

    await this.redis.del(KamnetAgentsService.agentCacheKey(agent.userId));

    // Notify agent by email
    const user = await this.usersService.findById(agent.userId);
    await this.emailService.send({
      to: user.email,
      template: 'agentReactivated',
      lang: user.language || 'fr',
      args: { firstName: user.firstName || user.email },
    });

    this.logger.log('Agent reactivated %o', {
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
