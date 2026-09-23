import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { KamnetProcessor } from '../../kamnet/processors/kamnet.processor';
import { KAMNET_JOBS, RoleCode } from '@kambriq/common';

/**
 * Tests for KamnetProcessor.
 * Ensures completed sales reliably produce agent commissions or fail observably,
 * preventing silently lost commissions.
 */
const makeJob = (name: string, data: unknown) => ({ name, data }) as unknown as Job;

const PAYLOAD = {
  agentUserId: 'user-1',
  landId: 'land-1',
  reservationId: 'resa-1',
};

describe('KamnetProcessor', () => {
  let processor: KamnetProcessor;
  let agentsService: { incrementSales: jest.Mock; checkPromotion: jest.Mock };
  let usersService: { findById: jest.Mock };
  let prisma: { kamnetAgent: { findUnique: jest.Mock } };

  beforeEach(() => {
    agentsService = {
      incrementSales: jest.fn(),
      checkPromotion: jest.fn().mockResolvedValue(null),
    };
    usersService = { findById: jest.fn() };
    prisma = { kamnetAgent: { findUnique: jest.fn() } };
    processor = new KamnetProcessor(agentsService as never, usersService as never, prisma as never);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('unknown job names', () => {
    it('throws rather than completing the job', async () => {
      await expect(processor.process(makeJob('kamnet.pay-everyone', {}))).rejects.toThrow(
        /Unknown KAMNET job: kamnet\.pay-everyone/,
      );
    });

    it('does not touch the agent when the name is unknown', async () => {
      await processor.process(makeJob('kamnet.pay-everyone', {})).catch(() => undefined);

      expect(usersService.findById).not.toHaveBeenCalled();
      expect(agentsService.incrementSales).not.toHaveBeenCalled();
    });
  });

  describe('a sale whose agent cannot be resolved', () => {
    it('fails the job when the user does not exist in core', async () => {
      usersService.findById.mockRejectedValue(new Error('not found'));

      await expect(processor.process(makeJob(KAMNET_JOBS.SALE_COMPLETED, PAYLOAD))).rejects.toThrow(
        /agent user does not exist in core/,
      );
    });

    it('names the agent and the reservation, so the failed job can be traced', async () => {
      usersService.findById.mockRejectedValue(new Error('not found'));

      await expect(processor.process(makeJob(KAMNET_JOBS.SALE_COMPLETED, PAYLOAD))).rejects.toThrow(
        /agentUserId=user-1.*reservationId=resa-1/,
      );
    });

    it('fails the job when the user exists but has no KAMNET agent row', async () => {
      usersService.findById.mockResolvedValue({ id: 'user-1', roles: [RoleCode.AGENT] });
      prisma.kamnetAgent.findUnique.mockResolvedValue(null);

      await expect(processor.process(makeJob(KAMNET_JOBS.SALE_COMPLETED, PAYLOAD))).rejects.toThrow(
        /no KAMNET agent row exists/,
      );
      expect(agentsService.incrementSales).not.toHaveBeenCalled();
    });
  });

  describe('a sale completed by an admin', () => {
    /**
     * Legitimate skip: an admin closing a sale has no commission to track.
     * The job completes with an explicit reason rather than a bare null.
     */
    it('completes with an explicit skip reason instead of failing', async () => {
      usersService.findById.mockResolvedValue({ id: 'user-1', roles: [RoleCode.ADMIN_GLOBAL] });
      prisma.kamnetAgent.findUnique.mockResolvedValue(null);

      const result = await processor.process(makeJob(KAMNET_JOBS.SALE_COMPLETED, PAYLOAD));

      expect(result).toEqual({ skipped: true, reason: 'admin' });
      expect(agentsService.incrementSales).not.toHaveBeenCalled();
    });
  });

  describe('a sale by a real agent', () => {
    beforeEach(() => {
      usersService.findById.mockResolvedValue({ id: 'user-1', roles: [RoleCode.AGENT] });
      prisma.kamnetAgent.findUnique.mockResolvedValue({
        id: 'agent-1',
        agentCode: 'AGT-2025-0001',
        salesCount: 4,
        tier: 'BRONZE',
      });
    });

    it('increments the sales count', async () => {
      const result = await processor.process(makeJob(KAMNET_JOBS.SALE_COMPLETED, PAYLOAD));

      expect(agentsService.incrementSales).toHaveBeenCalledWith('agent-1');
      expect(result).toMatchObject({ agentId: 'agent-1', salesCount: 5, promoted: false });
    });

    it('reports a promotion when the agent qualifies', async () => {
      agentsService.checkPromotion.mockResolvedValue({ tier: 'SILVER' });

      const result = await processor.process(makeJob(KAMNET_JOBS.SALE_COMPLETED, PAYLOAD));

      expect(result).toMatchObject({ promoted: true, newTier: 'SILVER' });
    });
  });
});
