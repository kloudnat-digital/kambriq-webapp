import { ConfigService } from '@nestjs/config';
import { PaymentState, ONE_DAY_MS } from '@kambriq/common';
import { DunningService, DunningSweepError } from '../../../lands/payments/dunning.service';
import type { PaymentsService } from '../../../lands/payments/payments.service';
import type { LandsPrismaService } from '../../../lands/prisma/lands-prisma.service';
import type { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { mockLandsPrisma, mockCorePrisma, type MockLandsPrisma } from '../../utils/mocks';

/**
 * G6 - the dunning queue, the reminders, and the one automatic transition.
 *
 * v03 *"Rien ne peut dormir en silence"*. Three behaviours, and the fourth thing
 * this file holds is a **deliberate omission**: `EXPIRE` is not in
 * `COMMITTING_STATES`, so the sweep may make that transition with no person's
 * name on it. `payment-state.spec` proves the guard; the mutation recorded in
 * the PR proves this exception is intended rather than an oversight.
 */
const config = (values: Record<string, string | number | undefined> = {}) =>
  ({
    get: (key: string, fallback?: unknown) => values[key] ?? fallback,
  }) as unknown as ConfigService;

const at = (days: number) => new Date(Date.now() + days * ONE_DAY_MS);

/** The `where`/`orderBy` a prisma mock was called with, typed for assertions. */
type FindArgs = {
  where: Record<string, unknown> & { state?: string; expiresAt?: { lt?: Date } };
  orderBy?: unknown;
};
const argsOf = (m: jest.Mock, call = 0): FindArgs => m.mock.calls[call][0] as FindArgs;

/** A full PaginationQuery - `sort` and `order` are required by the type. */
const page1 = { page: 1, limit: 20, sort: 'createdAt', order: 'asc' as const };

const payment = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'pay-1',
  reference: 'KBQ-2609-3ZPQC-F',
  reservationId: 'res-1',
  currency: 'XAF',
  amountDue: 750_000n,
  state: PaymentState.INSTRUCTIONS_ENVOYEES,
  channel: 'MOMO',
  preferredChannel: 'OMO',
  createdAt: at(-25),
  expiresAt: at(5),
  reminders: [],
  receipts: [],
  ...over,
});

const build = (
  opts: {
    prisma?: MockLandsPrisma;
    payments?: Partial<PaymentsService>;
    config?: Record<string, string | number | undefined>;
  } = {},
) => {
  const prisma = opts.prisma ?? mockLandsPrisma();
  const core = mockCorePrisma();
  core.user.findUnique.mockResolvedValue({ email: 'client@maildrop.cc', preferredLanguage: 'fr' });
  prisma.landReservation.findUnique.mockResolvedValue({
    clientName: 'A Client',
    clientEmail: 'client@maildrop.cc',
    clientUserId: 'user-1',
    land: { title: 'Lot 12, Douala' },
  });
  const payments = {
    sendReminder: jest.fn().mockResolvedValue({ sent: true, overdue: false }),
    transition: jest.fn().mockResolvedValue({ id: 'pay-1' }),
    ...opts.payments,
  } as unknown as PaymentsService;

  const service = new DunningService(
    prisma as unknown as LandsPrismaService,
    core as unknown as CorePrismaService,
    payments,
    config(opts.config),
  );
  return { service, prisma, payments };
};

describe('G6 - the reminder schedule', () => {
  it('refuses a schedule it cannot parse rather than falling back to the default', async () => {
    // A misconfigured schedule that quietly becomes "7,1" is a setting that
    // looks applied and is not - the PAYMENT_CHANNELS_SSM_PREFIX defect again.
    const { service, prisma } = build({ config: { PAYMENT_REMINDER_OFFSETS_DAYS: 'soon, later' } });
    prisma.payment.findMany.mockResolvedValue([]);

    await expect(service.sweep()).rejects.toThrow(/contains no usable day offsets/);
  });

  it('sends the J-7 reminder once the deadline is seven days out, and records it', async () => {
    const { service, prisma, payments } = build();
    const p = payment({ expiresAt: at(6) });
    prisma.payment.findMany.mockResolvedValueOnce([p]).mockResolvedValueOnce([]);

    const result = await service.sweep();

    expect(payments.sendReminder).toHaveBeenCalledTimes(1);
    expect(result.remindersSent).toBe(1);
    expect(prisma.paymentReminder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paymentId: 'pay-1', offsetDays: 7 }),
      }),
    );
  });

  it('does not send the same reminder twice, however often the sweep runs', async () => {
    // The idempotency the UNIQUE(paymentId, offsetDays) index enforces in the
    // database, asserted at the level that decides to send.
    const { service, prisma, payments } = build();
    const p = payment({ expiresAt: at(6), reminders: [{ offsetDays: 7 }] });
    prisma.payment.findMany.mockResolvedValueOnce([p]).mockResolvedValueOnce([]);

    const result = await service.sweep();

    expect(payments.sendReminder).not.toHaveBeenCalled();
    expect(result.remindersSent).toBe(0);
  });

  it('records the reminder only after the send returned', async () => {
    // G3's send-before-transition rule, applied to the reminder ledger. The
    // other order records a reminder that was never sent, and then never sends
    // it - the client hears nothing and the system believes it spoke.
    const { service, prisma } = build({
      payments: { sendReminder: jest.fn().mockRejectedValue(new Error('SES refused')) },
    });
    prisma.payment.findMany
      .mockResolvedValueOnce([payment({ expiresAt: at(6) })])
      .mockResolvedValueOnce([]);

    await expect(service.sweep()).rejects.toThrow(DunningSweepError);
    expect(prisma.paymentReminder.create).not.toHaveBeenCalled();
  });
});

describe('G6 - EXPIRE at the term', () => {
  it('expires a payment past its deadline, with its reason on the audit row', async () => {
    const { service, prisma, payments } = build();
    const overdue = payment({ expiresAt: at(-1) });
    prisma.payment.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([overdue]);

    const result = await service.sweep();

    expect(result.expired).toBe(1);
    expect(payments.transition).toHaveBeenCalledWith(
      'pay-1',
      PaymentState.EXPIRE,
      expect.objectContaining({
        actorUserId: 'system',
        // Not "expired" - the state already says that. The reason names the
        // term, which is the "pourquoi" the audit row is for.
        reason: expect.stringContaining('Validity period elapsed on'),
      }),
    );
  });

  it('reminds before it expires, so a payment due both is not silently lapsed', async () => {
    const { service, prisma, payments } = build();
    prisma.payment.findMany
      .mockResolvedValueOnce([payment({ expiresAt: at(0) })])
      .mockResolvedValueOnce([payment({ expiresAt: at(0) })]);

    await service.sweep();

    const reminderOrder = (payments.sendReminder as jest.Mock).mock.invocationCallOrder[0];
    const transitionOrder = (payments.transition as jest.Mock).mock.invocationCallOrder[0];
    expect(reminderOrder).toBeLessThan(transitionOrder);
  });
});

describe('G6 - the queue does not chase money that has arrived', () => {
  // (d) - the states that must never be reminded and never expired.
  it.each([PaymentState.VALIDE, PaymentState.REJETE, PaymentState.ANNULE, PaymentState.EXPIRE])(
    'never reminds or expires a payment in %s',
    async (state) => {
      const { service, prisma, payments } = build();
      // The service filters in the query, so the assertion that matters is that
      // the query is scoped - a filter applied in JS after fetching everything
      // would pass a mock that returns nothing regardless.
      prisma.payment.findMany.mockResolvedValue([]);

      await service.sweep();

      for (let i = 0; i < prisma.payment.findMany.mock.calls.length; i += 1) {
        expect(argsOf(prisma.payment.findMany, i).where.state).toBe(
          PaymentState.INSTRUCTIONS_ENVOYEES,
        );
        expect(argsOf(prisma.payment.findMany, i).where.state).not.toBe(state);
      }
      expect(payments.sendReminder).not.toHaveBeenCalled();
      expect(payments.transition).not.toHaveBeenCalled();
    },
  );

  it('scopes the overdue queue to INSTRUCTIONS_ENVOYEES with an elapsed deadline', async () => {
    const { service, prisma } = build();
    prisma.payment.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(0);
    prisma.payment.findFirst.mockResolvedValue(null);

    await service.listOverdueQueue(page1);

    const where = argsOf(prisma.payment.findMany).where;
    expect(where.state).toBe(PaymentState.INSTRUCTIONS_ENVOYEES);
    expect(where.expiresAt.lt).toBeInstanceOf(Date);
  });
});

describe('G6 - the queue reports its own backlog', () => {
  it('is oldest deadline first, and ages both the row and the backlog', async () => {
    const { service, prisma } = build();
    prisma.payment.findMany.mockResolvedValue([
      payment({ createdAt: at(-40), expiresAt: at(-10) }),
    ]);
    prisma.payment.count.mockResolvedValue(1);
    prisma.payment.findFirst.mockResolvedValue({ createdAt: at(-40) });
    prisma.landReservation.findMany.mockResolvedValue([
      { id: 'res-1', clientName: 'A Client', clientUserId: 'user-1', land: { title: 'Lot 12' } },
    ]);

    const result = await service.listOverdueQueue(page1);

    expect(argsOf(prisma.payment.findMany).orderBy).toEqual({ expiresAt: 'asc' });
    expect(result.data[0].waitingDays).toBe(40);
    expect(result.data[0].overdueDays).toBe(10);
    // The whole backlog, not this page - the question a count cannot answer.
    expect(result.meta.oldestWaitingDays).toBe(40);
  });

  it('never reports a negative overdueDays', async () => {
    // Clamped at zero. A payment due tomorrow is not overdue by minus one day,
    // and a queue that says so is a queue nobody reads twice.
    const { service, prisma } = build();
    prisma.payment.findMany.mockResolvedValue([payment({ expiresAt: at(3) })]);
    prisma.payment.count.mockResolvedValue(1);
    prisma.payment.findFirst.mockResolvedValue({ createdAt: at(-2) });
    prisma.landReservation.findMany.mockResolvedValue([
      { id: 'res-1', clientName: 'A', clientUserId: 'u', land: { title: 'L' } },
    ]);

    const result = await service.listOverdueQueue(page1);
    expect(result.data[0].overdueDays).toBe(0);
  });
});

describe('G6 - nothing fails silently', () => {
  it('fails the job when any payment could not be reminded, carrying the tally', async () => {
    // The sweep could return {remindersSent: 0, failures: [...]} and exit 0, and
    // the number would look like a result. That is the SES defect: a mechanism
    // reporting success by saying nothing about what did not happen.
    const { service, prisma } = build({
      payments: { sendReminder: jest.fn().mockRejectedValue(new Error('SES refused')) },
    });
    prisma.payment.findMany.mockImplementation((args: unknown) =>
      Promise.resolve((args as FindArgs).where.reference ? [payment({ expiresAt: at(6) })] : []),
    );

    // Both properties of the same throw: the type, and that it carries WHY.
    // A bare Error would say something went wrong and nothing about what.
    const error = await service.sweep().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DunningSweepError);
    expect((error as Error).message).toMatch(/SES refused/);
    expect((error as DunningSweepError).summary.failures[0]).toEqual(
      expect.objectContaining({ paymentId: 'pay-1', stage: 'reminder' }),
    );
  });

  it('refuses to skip a payment whose client cannot be addressed', async () => {
    const { service, prisma } = build();
    prisma.landReservation.findUnique.mockResolvedValue(null);
    prisma.payment.findMany
      .mockResolvedValueOnce([payment({ expiresAt: at(6) })])
      .mockResolvedValueOnce([]);

    // A payment nobody can chase is exactly what the queue exists for; skipping
    // it quietly would leave it invisible in both places.
    await expect(service.sweep()).rejects.toThrow(/cannot remind/);
  });

  it('the schedule lives outside payments.service.ts, so G3 assertion still holds', () => {
    const { readFileSync } = require('node:fs');
    const { join } = require('node:path');
    const root = join(__dirname, '..', '..', '..', 'lands', 'payments');
    // G3 asserts payments.service.ts has no @Cron, no setInterval, no `repeat:`.
    // G6 must put the schedule somewhere else rather than weaken that test.
    expect(readFileSync(join(root, 'payments.service.ts'), 'utf8')).not.toMatch(
      /@Cron|setInterval|repeat:/,
    );
    expect(readFileSync(join(root, 'dunning.scheduler.ts'), 'utf8')).toMatch(/repeat:/);
  });
});
