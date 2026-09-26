import { ForbiddenException } from '@nestjs/common';
import { PaymentPurpose, PaymentState } from '@kambriq/common';

import { LandReservationsService } from '../../../lands/reservations/reservations.service';
import type { LandsPrismaService } from '../../../lands/prisma/lands-prisma.service';
import type { UsersService } from '../../../core/users/users.service';
import {
  mockEmailService,
  mockI18n,
  mockLandsPrisma,
  mockQueue,
  mockStorageService,
} from '../../utils/mocks';

const RESERVATION = 'res-g20';
const ADMIN = 'admin-lands-1';

type Row = { reference: string; state: PaymentState; purpose: PaymentPurpose };

/**
 * A ledger read that honours the `where` it is given, so a gate that forgets to
 * ask for its purpose is caught: the mock answers exactly what Postgres would.
 */
const build = (rows: Row[], over: Record<string, unknown> = {}) => {
  const prisma = mockLandsPrisma();
  const service = new LandReservationsService(
    prisma as unknown as LandsPrismaService,
    {} as UsersService,
    mockEmailService() as never,
    mockStorageService() as never,
    mockI18n() as never,
    mockQueue() as never,
  );
  const reservation = {
    id: RESERVATION,
    status: 'PENDING',
    downPaymentConfirmed: false,
    documentsReceivedAt: null,
    remainingPaymentConfirmedAt: null,
    clientEmail: 'alice@example.test',
    clientName: 'Alice',
    ...over,
  };
  prisma.landReservation.findUnique.mockResolvedValue(reservation);
  prisma.landReservation.update.mockResolvedValue(reservation);
  prisma.payment.findMany.mockImplementation((args: unknown) => {
    const where = (args as { where: { purpose?: PaymentPurpose } }).where;
    return Promise.resolve(rows.filter((r) => !where.purpose || r.purpose === where.purpose));
  });
  return { prisma, service };
};

const row = (purpose: PaymentPurpose, state: PaymentState): Row => ({
  reference: `KBQ-${purpose}`,
  state,
  purpose,
});

/**
 * G20 - each step asks the ledger for its own purpose. Before, the deposit step
 * accepted any VALIDE payment on the reservation, so a validated balance would
 * have confirmed a deposit; and the balance step asked the ledger nothing.
 */
describe('G20 - the deposit and the balance steps each ask for their own payment', () => {
  it('a validated balance does not confirm the deposit', async () => {
    const { service } = build([row(PaymentPurpose.SOLDE, PaymentState.VALIDE)]);
    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('a validated deposit confirms the deposit', async () => {
    const { service } = build([row(PaymentPurpose.ACOMPTE, PaymentState.VALIDE)]);
    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).resolves.toBeDefined();
  });

  const atStepFour = {
    status: 'CONFIRMED',
    downPaymentConfirmed: true,
    documentsReceivedAt: new Date(),
  };

  it('the balance step refuses with no validated balance, even beside a validated deposit', async () => {
    const { service, prisma } = build(
      [row(PaymentPurpose.ACOMPTE, PaymentState.VALIDE)],
      atStepFour,
    );
    await expect(service.confirmRemainingPayment(RESERVATION, ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.landReservation.update).not.toHaveBeenCalled();
  });

  it('the balance step refuses a balance only partly received', async () => {
    const { service } = build(
      [row(PaymentPurpose.SOLDE, PaymentState.PARTIELLEMENT_RECU)],
      atStepFour,
    );
    await expect(service.confirmRemainingPayment(RESERVATION, ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('the balance step records the step once the balance is validated', async () => {
    const { service, prisma } = build([row(PaymentPurpose.SOLDE, PaymentState.VALIDE)], atStepFour);
    await service.confirmRemainingPayment(RESERVATION, ADMIN);
    expect(prisma.landReservation.update).toHaveBeenCalled();
  });
});

/**
 * G20 - the client's page states what was expected AND what is still owed, both
 * from the ledger. The diagnosis parcel: 3 400 000 total, 170 000 deposit due.
 */
describe('G20 - what the client is told they owe', () => {
  const detail = (receipts: Array<{ purpose: PaymentPurpose; amounts: bigint[] }>) => {
    const prisma = mockLandsPrisma();
    const service = new LandReservationsService(
      prisma as unknown as LandsPrismaService,
      { findManyByIds: jest.fn().mockResolvedValue([]) } as unknown as UsersService,
      mockEmailService() as never,
      mockStorageService() as never,
      mockI18n() as never,
      mockQueue() as never,
    );
    prisma.landReservation.findUnique.mockResolvedValue({
      id: RESERVATION,
      clientUserId: 'client-1',
      agentUserId: 'agent-1',
      status: 'CONFIRMED',
      downPaymentAmount: 170000,
      land: { totalPrice: 3_400_000n, documents: [] },
      landClientDocuments: [],
    });
    prisma.payment.findMany.mockResolvedValue(
      receipts.map((r) => ({
        purpose: r.purpose,
        receipts: r.amounts.map((amount) => ({ amount })),
      })),
    );
    return service.findOneForClient('client-1', RESERVATION);
  };

  it('a deposit received in full: the balance owed is the balance announced', async () => {
    const r = await detail([{ purpose: PaymentPurpose.ACOMPTE, amounts: [170000n] }]);
    expect(r.money).toEqual({
      totalPrice: 3_400_000,
      depositDue: 170_000,
      depositReceived: 170_000,
      balanceExpected: 3_230_000,
      balanceOwed: 3_230_000,
    });
  });

  it('a deposit received short: the page shows the shortfall in what is owed', async () => {
    const r = await detail([{ purpose: PaymentPurpose.ACOMPTE, amounts: [100000n, 60000n] }]);
    expect(r.money).toMatchObject({ balanceExpected: 3_230_000, balanceOwed: 3_240_000 });
  });

  it('what the balance itself received is taken off what is owed', async () => {
    const r = await detail([
      { purpose: PaymentPurpose.ACOMPTE, amounts: [170000n] },
      { purpose: PaymentPurpose.SOLDE, amounts: [1_000_000n] },
    ]);
    expect(r.money).toMatchObject({ balanceOwed: 2_230_000 });
  });
});
