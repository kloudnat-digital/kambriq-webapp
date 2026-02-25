import { KAMNET_JOBS, QUEUES, SaleCompletedJobPayload } from '@kambriq/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { KamnetAgentsService } from '../agents/agents.service';
import { KamnetPrismaService } from '../prisma/kamnet-prisma.service';
import { Job } from 'bullmq';

@Processor(QUEUES.KAMNET)
export class KamnetProcessor extends WorkerHost {
  private readonly logger = new Logger(KamnetProcessor.name);

  constructor(
    private readonly agentsService: KamnetAgentsService,
    private readonly prisma: KamnetPrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    switch (job.name) {
      case KAMNET_JOBS.SALE_COMPLETED:
        return this.handleSaleCompleted(job.data);
      default:
        this.logger.warn(`Unknown KAMNET job: ${job.name}`);
        return null;
    }
  }

  private async handleSaleCompleted(payload: SaleCompletedJobPayload) {
    const { agentUserId, landId, reservationId } = payload;

    this.logger.log('Processing sale completion', {
      agentUserId,
      landId,
      reservationId,
    });

    // 1. Find the agent by user ID
    const agent = await this.prisma.kamnetAgent.findUnique({
      where: { userId: agentUserId },
    });

    if (!agent) {
      this.logger.error(
        'Sale completed but no KAMNET agent found for user - skipping',
        { agentUserId },
      );
      return null;
    }

    // 2. Increment the agent's sales count
    await this.agentsService.incrementSales(agent.id);

    // 3. Check if the agent qualifies for a tier upgrade
    const promotion = await this.agentsService.checkPromotion(agent.id);

    if (promotion) {
      this.logger.log('Agent promoted after sale', {
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
