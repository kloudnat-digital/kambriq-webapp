import {
  KAMNET_JOBS,
  QUEUES,
  RoleCode,
  SaleCompletedJobPayload,
  LoudWorkerHost,
} from '@kambriq/common';
import { Processor } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { KamnetAgentsService } from '../agents/agents.service';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { Job } from 'bullmq';
import { UsersService } from '../../core/users/users.service';

@Processor(QUEUES.KAMNET)
export class KamnetProcessor extends LoudWorkerHost {
  private readonly logger = new Logger(KamnetProcessor.name);

  constructor(
    private readonly agentsService: KamnetAgentsService,
    private readonly usersService: UsersService,
    private readonly prisma: KamnetPrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case KAMNET_JOBS.SALE_COMPLETED:
        return this.handleSaleCompleted(job.data);
      default:
        throw new Error(`Unknown KAMNET job: ${job.name}`);
    }
  }

  private async handleSaleCompleted(payload: SaleCompletedJobPayload) {
    const { agentUserId, landId, reservationId } = payload;

    this.logger.log('Processing sale completion %o', {
      agentUserId,
      landId,
      reservationId,
    });

    // 1. Look up the user in core
    const user = await this.usersService.findById(agentUserId).catch(() => null);

    /**
     * Throws an error to fail the job if the user cannot be resolved.
     * This prevents silent failures and allows the job to be replayed,
     * ensuring commissions are not lost.
     */
    if (!user) {
      throw new Error(
        `Sale completed but the agent user does not exist in core (agentUserId=${agentUserId}, reservationId=${reservationId})`,
      );
    }

    // 2. Look up the kamnet record
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { userId: agentUserId },
    });

    if (!agent) {
      const roles = user.roles ?? [];
      const isAdmin = roles.includes(RoleCode.ADMIN_LANDS) || roles.includes(RoleCode.ADMIN_GLOBAL);

      if (isAdmin) {
        this.logger.log('Admin completed sale - no agent commission to track %o', {
          agentUserId,
          reservationId,
        });
        return { skipped: true, reason: 'admin' };
      }

      // Fail the job if the non-admin user lacks a KAMNET agent record.
      throw new Error(
        `Sale completed but no KAMNET agent row exists for the seller (agentUserId=${agentUserId}, reservationId=${reservationId})`,
      );
    }

    // 3. Increment the agent's sales count
    await this.agentsService.incrementSales(agent.id);

    // 4. Check if the agent qualifies for a tier upgrade
    const promotion = await this.agentsService.checkPromotion(agent.id);

    if (promotion) {
      this.logger.log('Agent promoted after sale %o', {
        agentId: agent.id,
        agentCode: agent.agentCode,
        newTier: promotion.tier,
      });
    }

    return {
      agentId: agent.id,
      salesCount: agent.salesCount + 1,
      promoted: !!promotion,
      newTier: promotion?.tier || agent.tier,
    };
  }
}
