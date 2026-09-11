import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailService,
  EvidenceRequiredError,
  PaymentChannel,
  PaymentState,
  StorageService,
} from '@kambriq/common';
import { PaymentsService } from '../../lands/payments/payments.service';
import { LandsPrismaService } from '../../lands/prisma/lands-prisma.service';
import { PaymentChannelsService } from '../../lands/payments/payment-channels.service';
import { CorePrismaService } from '../../core/prisma/core-prisma.service';
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockPaymentChannels,
  mockStorageService,
} from '../utils';
import { createPaymentFixture, openTestDatabase, type TestDatabase } from './lands-test-db';

/**
 * G7 - "sur quelle preuve", through the real service into the real database.
 *
 * The service is wired to a `LandsPrismaService` on the test database and to
 * mocks for everything that is not the lands database - core (identity), email,
 * storage, channel configuration. So `transition()` runs unchanged, its writes
 * land in Postgres, and the audit row is read back from the table rather than
 * from a mock's call arguments.
 */
describe('G7 - a transition records the receipt it rests on', () => {
  let db: TestDatabase;
  let lands: LandsPrismaService;
  let service: PaymentsService;

  const ADMIN = '00000000-0000-4000-8000-b00000000001';

  beforeAll(async () => {
    db = openTestDatabase();
    lands = new LandsPrismaService({
      get: (key: string) => (key === 'DATABASE_URL_LANDS' ? db.url : undefined),
    } as unknown as ConfigService);
    await lands.onModuleInit();

    const core = mockCorePrisma();
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });

    service = new PaymentsService(
      lands,
      mockPaymentChannels() as unknown as PaymentChannelsService,
      mockEmailService() as unknown as EmailService,
      mockStorageService() as unknown as StorageService,
      mockConfigService() as unknown as ConfigService,
      core as unknown as CorePrismaService,
    );
  });

  afterAll(async () => {
    await lands.onModuleDestroy();
    await db.close();
  });

  const record = (paymentId: string, amount: bigint) =>
    service.recordReceipt(
      paymentId,
      {
        amount,
        currency: 'XAF',
        channel: PaymentChannel.VIR,
        receivedAt: new Date('2026-09-02T00:00:00Z'),
        evidenceUrl: 'payments/a17/proof.pdf',
      },
      ADMIN,
    );

  it('PARTIELLEMENT_RECU writes the receipt id on its audit row', async () => {
    const payment = await createPaymentFixture(db.prisma, { state: PaymentState.EN_VERIFICATION });
    const receipt = await record(payment.id, 500_000n);

    await service.transitionAsAdmin(payment.id, PaymentState.PARTIELLEMENT_RECU, {
      actorUserId: ADMIN,
      reason: 'transfer confirmed on the bank statement',
      roles: ['ADMIN_GLOBAL'],
      evidenceReceiptId: receipt.id,
    });

    const trail = await db.prisma.paymentTransition.findMany({
      where: { paymentId: payment.id },
      orderBy: { occurredAt: 'asc' },
    });
    expect(trail).toHaveLength(1);
    expect(trail[0]).toMatchObject({
      fromState: PaymentState.EN_VERIFICATION,
      toState: PaymentState.PARTIELLEMENT_RECU,
      actorUserId: ADMIN,
      evidenceReceiptId: receipt.id,
    });

    // And it is readable the way the screen reads it.
    const detail = await service.findForBackOffice(payment.id);
    expect(detail.transitions[0].evidenceReceiptId).toBe(receipt.id);
  });

  it('VALIDE writes the receipt id on its audit row', async () => {
    const payment = await createPaymentFixture(db.prisma, {
      state: PaymentState.PARTIELLEMENT_RECU,
      amountDue: 500_000n,
    });
    const receipt = await record(payment.id, 500_000n);

    await service.validate(payment.id, {
      actorUserId: ADMIN,
      reason: 'the whole amount is in',
      evidenceReceiptId: receipt.id,
    });

    const row = await db.prisma.paymentTransition.findFirstOrThrow({
      where: { paymentId: payment.id, toState: PaymentState.VALIDE },
    });
    expect(row.evidenceReceiptId).toBe(receipt.id);
  });

  it('refuses PARTIELLEMENT_RECU with no receipt, and writes nothing', async () => {
    const payment = await createPaymentFixture(db.prisma, { state: PaymentState.EN_VERIFICATION });

    await expect(
      service.transitionAsAdmin(payment.id, PaymentState.PARTIELLEMENT_RECU, {
        actorUserId: ADMIN,
        reason: 'looks paid',
        roles: ['ADMIN_GLOBAL'],
      }),
    ).rejects.toThrow(EvidenceRequiredError);

    const after = await db.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(after.state).toBe(PaymentState.EN_VERIFICATION);
    await expect(
      db.prisma.paymentTransition.count({ where: { paymentId: payment.id } }),
    ).resolves.toBe(0);
  });

  it("refuses a receipt that is another payment's, and writes nothing", async () => {
    const mine = await createPaymentFixture(db.prisma, { state: PaymentState.EN_VERIFICATION });
    const theirs = await createPaymentFixture(db.prisma, { state: PaymentState.EN_VERIFICATION });
    const theirReceipt = await record(theirs.id, 500_000n);

    await expect(
      service.transitionAsAdmin(mine.id, PaymentState.PARTIELLEMENT_RECU, {
        actorUserId: ADMIN,
        reason: 'attaching the wrong sale',
        roles: ['ADMIN_GLOBAL'],
        evidenceReceiptId: theirReceipt.id,
      }),
    ).rejects.toThrow(BadRequestException);

    const after = await db.prisma.payment.findUniqueOrThrow({ where: { id: mine.id } });
    expect(after.state).toBe(PaymentState.EN_VERIFICATION);
  });

  it('a step that rests on no receipt carries NULL, deliberately', async () => {
    // INSTRUCTIONS_ENVOYEES -> ANNONCE_CLIENT is the client's word. Nothing is
    // demanded, and the row says NULL rather than the nearest receipt.
    const payment = await createPaymentFixture(db.prisma, {
      state: PaymentState.INSTRUCTIONS_ENVOYEES,
    });

    await service.transitionAsAdmin(payment.id, PaymentState.ANNONCE_CLIENT, {
      actorUserId: ADMIN,
      reason: 'the client telephoned to say the transfer was made',
      roles: ['ADMIN_LANDS'],
    });

    const row = await db.prisma.paymentTransition.findFirstOrThrow({
      where: { paymentId: payment.id },
    });
    expect(row.toState).toBe(PaymentState.ANNONCE_CLIENT);
    expect(row.evidenceReceiptId).toBeNull();
  });

  it('the audit row that names the receipt cannot be re-pointed afterwards', async () => {
    const payment = await createPaymentFixture(db.prisma, { state: PaymentState.EN_VERIFICATION });
    const receipt = await record(payment.id, 500_000n);
    const other = await record(payment.id, 100_000n);

    await service.transitionAsAdmin(payment.id, PaymentState.PARTIELLEMENT_RECU, {
      actorUserId: ADMIN,
      reason: 'first tranche',
      roles: ['ADMIN_GLOBAL'],
      evidenceReceiptId: receipt.id,
    });

    // The G7.2 clause meeting the G7.1d clause: "sur quelle preuve" is only an
    // answer if it cannot be changed later.
    await expect(
      db.pool.query(
        'UPDATE "PaymentTransition" SET "evidenceReceiptId" = $1 WHERE "paymentId" = $2',
        [other.id, payment.id],
      ),
    ).rejects.toMatchObject({ code: '23001' });
  });
});
