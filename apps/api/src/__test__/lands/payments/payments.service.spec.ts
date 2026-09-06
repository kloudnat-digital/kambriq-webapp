import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AutomaticTransitionForbiddenError,
  IllegalPaymentTransitionError,
  PaymentChannel,
  PaymentState,
} from '@kambriq/common';
import { PaymentsService } from '../../../lands/payments/payments.service';
import { LandsPrismaService } from '../../../lands/prisma/lands-prisma.service';
import { mockLandsPrisma } from '../../utils';

const PAYMENT_ID = 'pay-1';
const ADMIN = '00000000-0000-4000-8000-b00000000001';

const payment = (over: Record<string, unknown> = {}) => ({
  id: PAYMENT_ID,
  reference: null,
  reservationId: 'res-1',
  currency: 'XAF',
  amountDue: 15_000_000n,
  state: PaymentState.EN_VERIFICATION,
  ...over,
});

const receipt = (over: Record<string, unknown> = {}) => ({
  amount: 500_000n,
  currency: 'XAF',
  channel: PaymentChannel.VIREMENT,
  receivedAt: new Date('2026-09-01'),
  evidenceUrl: 's3://proofs/one.pdf',
  ...over,
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockLandsPrisma();
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService, { provide: LandsPrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PaymentsService);
  });

  // ----- THE LEDGER ----- //

  describe('the total received is a sum over the ledger', () => {
    it('records three partial encaissements and computes the total', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment());
      prisma.paymentReceipt.create
        .mockResolvedValueOnce({ id: 'r1' })
        .mockResolvedValueOnce({ id: 'r2' })
        .mockResolvedValueOnce({ id: 'r3' });

      await service.recordReceipt(PAYMENT_ID, receipt({ amount: 500_000n }), ADMIN);
      await service.recordReceipt(
        PAYMENT_ID,
        receipt({ amount: 2_250_000n, channel: PaymentChannel.MOBILE_MONEY }),
        ADMIN,
      );
      await service.recordReceipt(
        PAYMENT_ID,
        receipt({ amount: 1_000_000n, channel: PaymentChannel.ACTE_NOTARIE }),
        ADMIN,
      );

      expect(prisma.paymentReceipt.create).toHaveBeenCalledTimes(3);

      prisma.paymentReceipt.findMany.mockResolvedValue([
        { amount: 500_000n },
        { amount: 2_250_000n },
        { amount: 1_000_000n },
      ]);

      await expect(service.totalReceived(PAYMENT_ID)).resolves.toBe(3_750_000n);
    });

    it('recording money changes no state', async () => {
      // The whole reason there are two calls. `confirmDownPayment` wrote the
      // money flag and the reservation status in one update.
      prisma.payment.findUnique.mockResolvedValue(payment());
      prisma.paymentReceipt.create.mockResolvedValue({ id: 'r1' });

      await service.recordReceipt(PAYMENT_ID, receipt(), ADMIN);

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('a correction appends a negative line and never edits one', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment());
      prisma.paymentReceipt.create.mockResolvedValue({ id: 'r4' });

      await service.recordReceipt(
        PAYMENT_ID,
        receipt({ amount: -250_000n, correctsId: 'r2', note: 'keyed twice' }),
        ADMIN,
      );

      const arg = prisma.paymentReceipt.create.mock.calls[0][0] as {
        data: { amount: bigint; correctsId: string };
      };
      expect(arg.data.amount).toBe(-250_000n);
      expect(arg.data.correctsId).toBe('r2');

      prisma.paymentReceipt.findMany.mockResolvedValue([
        { amount: 500_000n },
        { amount: 2_250_000n },
        { amount: -250_000n },
      ]);
      await expect(service.totalReceived(PAYMENT_ID)).resolves.toBe(2_500_000n);
    });

    it('writing the total directly is impossible by construction', () => {
      /**
       * Not "discouraged" - absent. There is no column to write.
       *
       * Asserted against the schema rather than against the client, because the
       * client is generated from the schema and a test that reads the generated
       * type would be reading the same claim twice.
       */
      const schema = readFileSync(
        join(__dirname, '..', '..', '..', '..', '..', '..', 'prisma', 'lands', 'schema.prisma'),
        'utf8',
      );
      const model = schema.slice(
        schema.indexOf('model Payment {'),
        schema.indexOf('\n}', schema.indexOf('model Payment {')),
      );

      expect(model).toContain('amountDue');
      for (const forbidden of ['totalReceived', 'totalPaid', 'amountReceived', 'balance']) {
        expect(model).not.toContain(forbidden);
      }

      // And the service exposes no setter for it either.
      expect(Object.getOwnPropertyNames(Object.getPrototypeOf(service))).not.toContain(
        'setTotalReceived',
      );
    });

    it('refuses a receipt with no evidence, and a zero receipt', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment());

      await expect(
        service.recordReceipt(PAYMENT_ID, receipt({ evidenceUrl: '  ' }), ADMIN),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.recordReceipt(PAYMENT_ID, receipt({ amount: 0n }), ADMIN),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentReceipt.create).not.toHaveBeenCalled();
    });

    it('refuses the backfill channel as an input', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment());

      await expect(
        service.recordReceipt(
          PAYMENT_ID,
          receipt({ channel: PaymentChannel.INCONNU_HISTORIQUE }),
          ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentReceipt.create).not.toHaveBeenCalled();
    });

    it('refuses a receipt in a different currency from the payment', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment({ currency: 'XAF' }));

      await expect(
        service.recordReceipt(PAYMENT_ID, receipt({ currency: 'EUR' }), ADMIN),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ----- THE STATE MACHINE ----- //

  describe('transitions', () => {
    it('moves the payment and writes the audit row in one transaction', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment({ state: PaymentState.EN_VERIFICATION }));
      prisma.payment.update.mockResolvedValue({});
      prisma.paymentTransition.create.mockResolvedValue({});

      await service.transition(PAYMENT_ID, PaymentState.PARTIELLEMENT_RECU, {
        actorUserId: ADMIN,
        reason: 'transfer receipt checked against the bank statement',
        evidenceReceiptId: 'r1',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      const audit = prisma.paymentTransition.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(audit.data).toMatchObject({
        fromState: PaymentState.EN_VERIFICATION,
        toState: PaymentState.PARTIELLEMENT_RECU,
        actorUserId: ADMIN,
        evidenceReceiptId: 'r1',
      });
      expect(audit.data['reason']).toContain('bank statement');
    });

    it('refuses an edge the state machine does not have', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment({ state: PaymentState.INITIE }));

      await expect(
        service.transition(PAYMENT_ID, PaymentState.VALIDE, {
          actorUserId: ADMIN,
          reason: 'skipping ahead',
        }),
      ).rejects.toThrow(IllegalPaymentTransitionError);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('refuses a committing transition made on behalf of a system actor', async () => {
      // The barrier. `KCA_CERTIFIED` was granted on an exam score; here the
      // boundary commits money.
      prisma.payment.findUnique.mockResolvedValue(
        payment({ state: PaymentState.PARTIELLEMENT_RECU }),
      );

      await expect(
        service.transition(PAYMENT_ID, PaymentState.VALIDE, {
          actorUserId: 'system',
          reason: 'balance reached',
        }),
      ).rejects.toThrow(AutomaticTransitionForbiddenError);
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('refuses a committing transition with no reason', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        payment({ state: PaymentState.PARTIELLEMENT_RECU }),
      );

      await expect(
        service.transition(PAYMENT_ID, PaymentState.VALIDE, { actorUserId: ADMIN, reason: '  ' }),
      ).rejects.toThrow(AutomaticTransitionForbiddenError);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('allows the dunning job to expire a stalled payment', async () => {
      // The design's single automatic transition: "passe en EXPIRE au terme".
      prisma.payment.findUnique.mockResolvedValue(
        payment({ state: PaymentState.INSTRUCTIONS_ENVOYEES }),
      );
      prisma.payment.update.mockResolvedValue({});
      prisma.paymentTransition.create.mockResolvedValue({});

      await expect(
        service.transition(PAYMENT_ID, PaymentState.EXPIRE, {
          actorUserId: 'system',
          reason: 'validity elapsed',
        }),
      ).resolves.toEqual({ state: PaymentState.EXPIRE });
    });
  });
});
