import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { KamnetCommissionStatus, KAMNET_VALID_COMMISSION_TRANSITIONS } from '@kambriq/common';
import { KamnetCommissionsService } from '../../../kamnet/commissions/commissions.service';
import { KamnetPrismaService } from '../../../kamnet/prisma/kamnet-prisma.service';
import { mockI18n } from '../../utils';

/**
 * A4 - unit tests for the commission write paths.
 *
 * `amount` is deliberately not asserted against `pv` and `tpc`: no code computes
 * it. The service stores all three as given, so the two factors cannot be
 * checked against the amount without first deciding the commission formula. That
 * decision is open (A4 in the register).
 */
describe('A4 - KamnetCommissionsService', () => {
  let service: KamnetCommissionsService;
  let prisma: {
    kamnetAgent: { findUnique: jest.Mock };
    kamnetCommission: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const AGENT = '00000000-0000-4000-8000-a00000000001';
  const OTHER_AGENT = '00000000-0000-4000-8000-a00000000002';
  const COMMISSION = '00000000-0000-4000-8000-c00000000001';

  const dto = {
    agentId: AGENT,
    landId: '00000000-0000-4000-8000-100000000001',
    reservationId: '00000000-0000-4000-8000-200000000001',
    level: 0,
    pv: 1,
    tpc: 0.05,
    amount: 750_000,
  };

  beforeEach(async () => {
    prisma = {
      kamnetAgent: { findUnique: jest.fn().mockResolvedValue({ id: AGENT }) },
      kamnetCommission: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: COMMISSION, ...data })),
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: COMMISSION, status: KamnetCommissionStatus.PENDING }),
        update: jest.fn().mockImplementation(({ data }) => ({ id: COMMISSION, ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null }, _count: 0 }),
      },
      // The real client runs the array and returns each result in order.
      $transaction: jest.fn((operations: unknown[]) => Promise.all(operations)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KamnetCommissionsService,
        { provide: KamnetPrismaService, useValue: prisma },
        { provide: I18nService, useValue: mockI18n() },
      ],
    }).compile();

    service = module.get(KamnetCommissionsService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    it('refuses a commission for an agent that does not exist', async () => {
      prisma.kamnetAgent.findUnique.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
      expect(prisma.kamnetCommission.create).not.toHaveBeenCalled();
    });

    it('stores the amount as integer money, never as a number', async () => {
      // XAF has no minor unit, so the amount is whole francs as a BigInt.
      await service.create(dto);

      const { data } = prisma.kamnetCommission.create.mock.calls[0][0];
      expect(typeof data.amount).toBe('bigint');
      expect(data.amount).toBe(750_000n);
    });

    it('opens every commission at PENDING, whatever the caller asked for', async () => {
      // The status is not in the DTO, so a caller cannot create one already PAID.
      await service.create({ ...dto, status: KamnetCommissionStatus.PAID } as typeof dto);

      const { data } = prisma.kamnetCommission.create.mock.calls[0][0];
      expect(data.status).toBe(KamnetCommissionStatus.PENDING);
    });

    it('records the two factors it was given, unchanged', async () => {
      await service.create(dto);

      const { data } = prisma.kamnetCommission.create.mock.calls[0][0];
      expect({ pv: data.pv, tpc: data.tpc, level: data.level }).toEqual({
        pv: 1,
        tpc: 0.05,
        level: 0,
      });
    });
  });

  describe('updateStatus', () => {
    it('refuses a commission that does not exist', async () => {
      prisma.kamnetCommission.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(COMMISSION, { status: KamnetCommissionStatus.VALIDATED }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.kamnetCommission.update).not.toHaveBeenCalled();
    });

    it('allows PENDING to VALIDATED', async () => {
      const updated = await service.updateStatus(COMMISSION, {
        status: KamnetCommissionStatus.VALIDATED,
      });

      expect(updated.status).toBe(KamnetCommissionStatus.VALIDATED);
    });

    it('refuses PENDING straight to PAID, so nothing is paid without being validated', async () => {
      await expect(
        service.updateStatus(COMMISSION, { status: KamnetCommissionStatus.PAID }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.kamnetCommission.update).not.toHaveBeenCalled();
    });

    it('refuses any move out of PAID, which is terminal', async () => {
      prisma.kamnetCommission.findUnique.mockResolvedValue({
        id: COMMISSION,
        status: KamnetCommissionStatus.PAID,
      });

      await expect(
        service.updateStatus(COMMISSION, { status: KamnetCommissionStatus.VALIDATED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('asks the shared transition map rather than a list of its own', async () => {
      // Read from the shared constant, so a second copy of the machine cannot
      // drift from it unnoticed.
      prisma.kamnetCommission.findUnique.mockResolvedValue({
        id: COMMISSION,
        status: KamnetCommissionStatus.VALIDATED,
      });
      const allowed = KAMNET_VALID_COMMISSION_TRANSITIONS[KamnetCommissionStatus.VALIDATED];
      expect(allowed).toEqual([KamnetCommissionStatus.PAID]);

      for (const target of Object.values(KamnetCommissionStatus)) {
        prisma.kamnetCommission.update.mockClear();
        const attempt = service.updateStatus(COMMISSION, { status: target });
        if (allowed.includes(target)) await expect(attempt).resolves.toBeDefined();
        else await expect(attempt).rejects.toThrow(BadRequestException);
      }
    });

    it('stamps paidAt on PAID and on nothing else', async () => {
      prisma.kamnetCommission.findUnique.mockResolvedValue({
        id: COMMISSION,
        status: KamnetCommissionStatus.VALIDATED,
      });
      await service.updateStatus(COMMISSION, { status: KamnetCommissionStatus.PAID });
      expect(prisma.kamnetCommission.update.mock.calls[0][0].data.paidAt).toBeInstanceOf(Date);

      prisma.kamnetCommission.findUnique.mockResolvedValue({
        id: COMMISSION,
        status: KamnetCommissionStatus.PENDING,
      });
      prisma.kamnetCommission.update.mockClear();
      await service.updateStatus(COMMISSION, { status: KamnetCommissionStatus.VALIDATED });
      expect(prisma.kamnetCommission.update.mock.calls[0][0].data).not.toHaveProperty('paidAt');
    });
  });

  describe("an agent reads their own commissions and nobody else's", () => {
    const query = { page: 1, limit: 20, sort: 'createdAt', order: 'desc' as const };

    it('scopes the rows and the count to the caller', async () => {
      await service.findMyCommissions(AGENT, query);

      const [findMany, count] = [
        prisma.kamnetCommission.findMany.mock.calls[0][0],
        prisma.kamnetCommission.count.mock.calls[0][0],
      ];
      expect(findMany.where).toEqual({ agentId: AGENT });
      // The count must carry the same filter as the rows, or the total
      // describes a different population from the page.
      expect(count.where).toEqual({ agentId: AGENT });
    });

    it('keeps the caller when a status filter is added, rather than replacing it', async () => {
      await service.findMyCommissions(AGENT, query, {
        status: KamnetCommissionStatus.PAID,
        agentId: OTHER_AGENT,
      });

      // `agentId` exists in the filter DTO for the admin route. Here the
      // caller's own id must win, or an agent reads another agent's pay.
      expect(prisma.kamnetCommission.findMany.mock.calls[0][0].where).toEqual({
        agentId: AGENT,
        status: KamnetCommissionStatus.PAID,
      });
    });
  });

  describe('getSummary', () => {
    it('scopes all three totals to the caller', async () => {
      await service.getSummary(AGENT);

      const wheres = prisma.kamnetCommission.aggregate.mock.calls.map((c) => c[0].where);
      expect(wheres).toHaveLength(3);
      expect(wheres.every((w) => w.agentId === AGENT)).toBe(true);
      expect(wheres.map((w) => w.status)).toEqual([
        KamnetCommissionStatus.PENDING,
        KamnetCommissionStatus.VALIDATED,
        KamnetCommissionStatus.PAID,
      ]);
    });

    it('answers an empty ledger with integer zero, not null', async () => {
      // Prisma returns a null `_sum` when nothing matched; the total is 0 XAF.
      const summary = await service.getSummary(AGENT);

      expect(summary.pending.totalAmount).toBe(0n);
      expect(typeof summary.validated.totalAmount).toBe('bigint');
      expect(summary.paid.count).toBe(0);
    });

    it('passes a real sum through as integer money', async () => {
      prisma.kamnetCommission.aggregate.mockResolvedValue({
        _sum: { amount: 1_500_000n },
        _count: 2,
      });

      const summary = await service.getSummary(AGENT);

      expect(summary.paid).toEqual({ count: 2, totalAmount: 1_500_000n });
    });
  });
});
