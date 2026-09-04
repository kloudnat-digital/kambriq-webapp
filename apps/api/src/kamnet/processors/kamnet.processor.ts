import { KAMNET_JOBS, QUEUES, RoleCode, SaleCompletedJobPayload } from '@kambriq/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { KamnetAgentsService } from '../agents/agents.service';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { Job } from 'bullmq';
import { UsersService } from '../../core/users/users.service';

@Processor(QUEUES.KAMNET)
export class KamnetProcessor extends WorkerHost {
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
     * This is money, and a resolved promise marks the job completed.
     *
     * Logging an error and returning `null` left the sale recorded, the job
     * green, and the agent's commission never created. Nothing anywhere held a
     * count of sales that produced no commission, so the only way to find it
     * would be an agent noticing they had not been paid. Throwing puts the job
     * on the failed set with its payload intact, where it can be counted and
     * replayed once the cause is fixed.
     *
     * A sale whose agent cannot be resolved is not a sale to skip. It is a sale
     * somebody has to look at.
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

      // Same reasoning: the user exists and is not an admin, so a KAMNET agent
      // row should exist and does not. The commission cannot be attributed, and
      // silence would be the only symptom.
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
