import { ConfigService } from '@nestjs/config';
import {
  EmailService,
  PaymentChannel,
  PaymentPurpose,
  PaymentState,
  StorageService,
} from '@kambriq/common';
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
 * C49 - the deposit and the balance read the sale, so a price revised between
 * them moves neither.
 *
 * The deposit was frozen on the reservation at creation; the balance read the
 * parcel's CURRENT total (`payments.service.ts`, "the parcel's total minus what
 * the deposit received"). An administrator who revised a parcel's price after a
 * client paid the deposit changed what that client was asked for the balance,
 * and not the deposit. Against the real lands migrations.
 */
describe('C49 - a revised parcel price moves neither the deposit nor the balance', () => {
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
      // The client's view attaches the agent's name; no agent is needed here.
      { findManyByIds: async () => [] } as unknown as UsersService,
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

  it('asks the balance of the sale, after the parcel was repriced', async () => {
    // A whole 500 m2 parcel sold at 15 000 000, deposit 750 000, settled.
    const deposit = await createPaymentFixture(db.prisma, {
      state: PaymentState.VALIDE,
      amountDue: 750_000n,
    });
    await db.prisma.paymentReceipt.create({
      data: {
        paymentId: deposit.id,
        amount: 750_000n,
        currency: 'XAF',
        channel: PaymentChannel.VIR,
        receivedAt: new Date('2026-10-02T08:00:00Z'),
        recordedBy: ADMIN,
        evidenceUrl: 'payments/c49/proof.pdf',
      },
    });
    const reservation = await db.prisma.landReservation.update({
      where: { id: deposit.reservationId },
      data: { documentsReceivedAt: new Date('2026-10-02T09:00:00Z') },
    });

    // The administrator revises the parcel's price afterwards.
    await db.prisma.land.update({
      where: { id: deposit.landId },
      data: { totalPrice: 20_000_000n },
    });

    const balance = await payments.requestPaymentForReservation(
      reservation.clientUserId as string,
      reservation.id,
    );
    // 15 000 000 sold, 750 000 received: 14 250 000. Reading the parcel gave 19 250 000.
    expect(balance.amountDue).toBe('14250000');

    const row = await db.prisma.payment.findUniqueOrThrow({ where: { id: balance.id } });
    expect(row.purpose).toBe(PaymentPurpose.SOLDE);

    const after = await db.prisma.landReservation.findUniqueOrThrow({
      where: { id: reservation.id },
    });
    expect(after.downPaymentAmount).toBe(750_000n);
    expect(after.saleAmount).toBe(15_000_000n);
  });

  it('shows the client the sale, not the repriced parcel', async () => {
    const deposit = await createPaymentFixture(db.prisma, {
      state: PaymentState.EN_VERIFICATION,
      amountDue: 750_000n,
    });
    const reservation = await db.prisma.landReservation.findUniqueOrThrow({
      where: { id: deposit.reservationId },
    });
    await db.prisma.land.update({
      where: { id: deposit.landId },
      data: { totalPrice: 20_000_000n },
    });

    const seen = await reservations.findOneForClient(
      reservation.clientUserId as string,
      reservation.id,
    );
    expect(seen.money).toMatchObject({
      totalPrice: 15_000_000,
      depositDue: 750_000,
      balanceExpected: 14_250_000,
    });
  });
});
