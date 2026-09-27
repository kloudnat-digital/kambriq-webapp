import { ConfigService } from '@nestjs/config';
import { EmailService, PaymentChannel, PaymentState, StorageService } from '@kambriq/common';
import { PaymentsService } from '../../lands/payments/payments.service';
import { LandsPrismaService } from '../../lands/prisma/lands-prisma.service';
import { PaymentChannelsService } from '../../lands/payments/payment-channels.service';
import { LandReservationsService } from '../../lands/reservations/reservations.service';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import type { UsersService } from '../../core/users/users.service';
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockI18n,
  mockPaymentChannels,
  mockQueue,
  mockStorageService,
} from '../utils';
import { createPaymentFixture, openTestDatabase, type TestDatabase } from './lands-test-db';

/**
 * G21 - cancelling a reservation annuls its live payment, with a written reason
 * Against the real lands migrations: the annulment is a
 * transition with an actor and a reason, the ledger keeps every receipt, nothing
 * is deleted - and nothing validatable is left behind a cancelled reservation.
 */
describe('G21 - a cancelled reservation leaves no live payment behind', () => {
  let db: TestDatabase;
  let lands: LandsPrismaService;
  let payments: PaymentsService;
  let reservations: LandReservationsService;
  const ADMIN = '00000000-0000-4000-8000-b00000000001';

  beforeAll(async () => {
    db = openTestDatabase();
    lands = new LandsPrismaService({
      get: (key: string) => (key === 'DATABASE_URL_LANDS' ? db.url : undefined),
    } as unknown as ConfigService);
    await lands.onModuleInit();
    const core = mockCorePrisma();
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });
    payments = new PaymentsService(
      lands,
      mockPaymentChannels() as unknown as PaymentChannelsService,
      mockEmailService() as unknown as EmailService,
      mockStorageService() as unknown as StorageService,
      mockConfigService() as unknown as ConfigService,
      core as unknown as CorePrismaService,
    );
    reservations = new LandReservationsService(
      lands,
      {} as UsersService,
      mockEmailService() as never,
      mockStorageService() as never,
      mockI18n() as never,
      mockQueue() as never,
      payments,
    );
  });

  afterAll(async () => {
    await lands.onModuleDestroy();
    await db.close();
  });

  const receipt = (paymentId: string, amount: bigint) =>
    payments.recordReceipt(
      paymentId,
      {
        amount,
        currency: 'XAF',
        channel: PaymentChannel.VIR,
        receivedAt: new Date('2026-09-20T00:00:00Z'),
        evidenceUrl: 'payments/g21/proof.pdf',
      },
      ADMIN,
    );

  it('annuls a live payment, with the cancellation reason on its audit row', async () => {
    const p = await createPaymentFixture(db.prisma, { state: PaymentState.INSTRUCTIONS_ENVOYEES });

    await reservations.cancel(p.reservationId, ADMIN, { reason: 'the client withdrew' });

    const after = await db.prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.state).toBe(PaymentState.ANNULE);
    const last = await db.prisma.paymentTransition.findFirstOrThrow({
      where: { paymentId: p.id },
      orderBy: { occurredAt: 'desc' },
    });
    expect(last).toMatchObject({
      fromState: PaymentState.INSTRUCTIONS_ENVOYEES,
      toState: PaymentState.ANNULE,
      actorUserId: ADMIN,
    });
    expect(last.reason).toContain('the client withdrew');
    expect(last.reason).toMatch(/reservation .* cancelled/i);
  });

  it('leaves nothing validatable behind: the annulled payment refuses VALIDE', async () => {
    const p = await createPaymentFixture(db.prisma, { state: PaymentState.EN_VERIFICATION });
    const r = await receipt(p.id, 750_000n);

    await reservations.cancel(p.reservationId, ADMIN, { reason: 'duplicate reservation' });

    await expect(
      payments.validate(p.id, { actorUserId: ADMIN, reason: 'late', evidenceReceiptId: r.id }),
    ).rejects.toThrow();
    const after = await db.prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.state).toBe(PaymentState.ANNULE);
  });

  it('keeps every receipt of a partly received payment - the ledger is append-only', async () => {
    const p = await createPaymentFixture(db.prisma, { state: PaymentState.EN_VERIFICATION });
    const r = await receipt(p.id, 300_000n);
    await payments.transition(p.id, PaymentState.PARTIELLEMENT_RECU, {
      actorUserId: ADMIN,
      reason: 'part received',
      evidenceReceiptId: r.id,
    });

    await reservations.cancel(p.reservationId, ADMIN, { reason: 'the client withdrew' });

    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).state).toBe(
      PaymentState.ANNULE,
    );
    expect(await db.prisma.paymentReceipt.count({ where: { paymentId: p.id } })).toBe(1);
  });

  it('does not touch a validated payment: money that arrived is not annulled', async () => {
    const p = await createPaymentFixture(db.prisma, { state: PaymentState.VALIDE });

    await reservations.cancel(p.reservationId, ADMIN, { reason: 'the client withdrew' });

    expect((await db.prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).state).toBe(
      PaymentState.VALIDE,
    );
  });
});
