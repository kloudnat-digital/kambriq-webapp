import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UsersService } from '../../core/users/users.service';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { I18nService } from 'nestjs-i18n';
import {
  KAMNET_MAX_FULL_TREE_ROOTS,
  KAMNET_MAX_SPONSORSHIP_DEPTH,
  KamnetAgentTier,
} from '@kambriq/common';

/**
 * Handles sponsorship tree queries for agents
 * The tree is self-referencing: each agent can have a sponsor
 * and multiple referralss, up to N3 depth
 *
 * - Agent view: "My network" = my direct referrals (N1) + their referrals (N2, N3)
 * - Admin view: Full hierarchical tree with optional depth filter
 */

@Injectable()
export class KamnetNetworkService {
  private readonly logger = new Logger(KamnetNetworkService.name);

  constructor(
    private readonly prisma: KamnetPrismaService,
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {}

  // ----- Get My Network ----- //
  /**
   * Returns the agent's referrals up to the specified depth.
   * depth=1 -> direct referrals (N1)
   * depth=2 -> N1 + their referrals (N2)
   * depth=3 -> N1 + N2 + their referrals (N3)
   *
   * "Who did I recruit, and who did they recruit?"
   */
  async getMyNetwork(userId: string, depth = 1) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { userId },
    });

    if (!agent) {
      throw new NotFoundException(this.t('kamnet.agent.notFound'));
    }

    const safeDepth = Math.min(depth, KAMNET_MAX_SPONSORSHIP_DEPTH);

    return this.buildTree(agent.id, safeDepth);
  }

  // ----- Admin: Get Full Tree ----- //
  // Returns the complete sponsorship tree from a root agent
  // or a capped list of root agents (agents without sponsors).
  //
  // When rootAgentId is provided: full tree up to requested depth.
  // When rootAgentId is absent: depth is clamped to 1 and results are
  // capped at MAX_FULL_TREE_ROOTS to prevent unbounded DB fan-out.

  async getFullTree(rootAgentId?: string, depth = 1) {
    const safeDepth = Math.min(depth, KAMNET_MAX_SPONSORSHIP_DEPTH);

    if (rootAgentId) {
      const agent = await this.prisma.kamnetAgent.findUnique({
        where: { id: rootAgentId },
      });

      if (!agent) {
        throw new NotFoundException(this.t('kamnet.agent.notFound'));
      }

      return this.buildTree(rootAgentId, safeDepth);
    }

    // No root specified: load overview only - clamp depth to 1 and cap root count.
    const overviewDepth = 1;
    const roots = await this.prisma.kamnetAgent.findMany({
      where: { sponsorId: null },
      orderBy: { createdAt: 'asc' },
      take: KAMNET_MAX_FULL_TREE_ROOTS,
    });

    const trees = await Promise.all(
      roots.map(async (root) => ({
        agent: await this.enrichAgent(root),
        referrals: await this.fetchReferrals(root.id, overviewDepth - 1),
      })),
    );

    return {
      roots: trees,
      totalRoots: roots.length,
      capped: roots.length === KAMNET_MAX_FULL_TREE_ROOTS,
    };
  }

  // ----- My Sponsor Chain ----- //
  /**
   * Walk up the tree: who sponsored me → who sponsored them → etc.
   * "Who recruited me, and who recruited them?"
   */
  async getMySponsorChain(userId: string) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { userId },
      include: { sponsor: true },
    });

    if (!agent) {
      throw new NotFoundException(this.t('kamnet.agent.notFound'));
    }

    const chain: Array<{
      id: string;
      agentCode: string;
      level: number;
      name?: string;
    }> = [];

    let current = agent.sponsor;
    let level = 1;

    // Walk up to 3 levels (N1, N2, N3)
    while (current && level <= KAMNET_MAX_SPONSORSHIP_DEPTH) {
      const user = await this.usersService.findById(current.userId);
      chain.push({
        id: current.id,
        agentCode: current.agentCode,
        level,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
      });

      // Load next sponsor
      const next = current.sponsorId
        ? await this.prisma.kamnetAgent.findUnique({
            where: { id: current.sponsorId },
          })
        : null;

      current = next;
      level++;
    }

    return {
      agent: {
        id: agent.id,
        agentCode: agent.agentCode,
      },
      chain,
    };
  }

  // ----- Private Helpers ----- //

  private async buildTree(agentId: string, depth: number) {
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { id: agentId },
    });

    if (!agent) return null;

    return {
      agent: await this.enrichAgent(agent),
      referrals: depth > 0 ? await this.fetchReferrals(agentId, depth - 1) : [],
    };
  }

  private async fetchReferrals(parentId: string, remainingDepth: number): Promise<unknown[]> {
    const children = await this.prisma.kamnetAgent.findMany({
      where: { sponsorId: parentId },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      children.map(async (child) => ({
        agent: await this.enrichAgent(child),
        referrals:
          remainingDepth > 0 ? await this.fetchReferrals(child.id, remainingDepth - 1) : [],
      })),
    );
  }

  private async enrichAgent(agent: {
    id: string;
    userId: string;
    agentCode: string;
    tier: KamnetAgentTier;
    salesCount: number;
    createdAt: Date;
  }) {
    const user = await this.usersService.findById(agent.userId);

    return {
      id: agent.id,
      agentCode: agent.agentCode,
      tier: agent.tier,
      salesCount: agent.salesCount,
      createdAt: agent.createdAt.toISOString(),
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        country: user.profile?.country ?? null,
        city: user.profile?.city ?? null,
      },
    };
  }

  private t(key: string, lang = 'fr', args?: Record<string, unknown>): string {
    return this.i18n.translate(key, { lang, args }) as string;
  }
}
