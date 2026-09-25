import { ConflictException, ForbiddenException } from '@nestjs/common';
import { PaymentState } from '@kambriq/common';

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

/**
 * The reservation's acompte step projects the payment ledger.
 *
 * G1 separated recording money from agreeing that it settles a payment, and put
 * every guarantee on `Payment`: an append-only ledger, one write path to the
 * state, a transition demanding a named actor and a reason, and an evidence
 * receipt drawn from that payment's own ledger. `LandReservation` is a different
 * table, so `confirmDownPayment` reached `CONFIRMED` through one bare update
 * with no amount, no currency, no receipt and no audit row - every barrier
 * bypassed by one admin button, and `payments.service.ts` describing that in the
 * past tense while it was still live.
 *
 * The direction it failed in is the dangerous one: the reservation told the
 * client their acompte had been received while the ledger held nothing at all,
 * and `complete()` requires `CONFIRMED`, so the agent's KAMNET commission was
 * downstream of it.
 */
const RESERVATION = 'res-1';
const ADMIN = 'admin-lands-1';

const reservation = (over: Record<string, unknown> = {}) => ({
  id: RESERVATION,
  status: 'PENDING',
  downPaymentConfirmed: false,
  clientEmail: 'alice@example.test',
  clientName: 'Alice',
  ...over,
});

const build = () => {
  const prisma = mockLandsPrisma();
  const email = mockEmailService();
  const service = new LandReservationsService(
    prisma as unknown as LandsPrismaService,
    {} as UsersService,
    email as never,
    mockStorageService() as never,
    mockI18n() as never,
    mockQueue() as never,
  );
  prisma.landReservation.findUnique.mockResolvedValue(reservation());
  prisma.landReservation.update.mockResolvedValue(reservation({ status: 'CONFIRMED' }));
  return { prisma, email, service };
};

/** Payments as `assertAcompteIsValidated` selects them. */
const ledger = (...states: PaymentState[]) =>
  states.map((state, i) => ({ reference: `KBQ-2609-AAAA${i}-C`, state }));

describe('the acompte step follows the payment ledger', () => {
  it('confirms when the reservation carries a VALIDE payment', async () => {
    const { prisma, service } = build();
    prisma.payment.findMany.mockResolvedValue(ledger(PaymentState.VALIDE));

    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).resolves.toMatchObject({
      status: 'CONFIRMED',
    });
    expect(prisma.landReservation.update).toHaveBeenCalledTimes(1);
  });

  it('refuses when the reservation carries no payment at all', async () => {
    // The state every PENDING reservation on dev is in: the client has never
    // been asked for the acompte, and the button said it had arrived.
    const { prisma, service } = build();
    prisma.payment.findMany.mockResolvedValue([]);

    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses while the payment is only awaiting the client', async () => {
    const { prisma, service } = build();
    prisma.payment.findMany.mockResolvedValue(ledger(PaymentState.INSTRUCTIONS_ENVOYEES));

    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses on PARTIELLEMENT_RECU, because part of the acompte is not the acompte', async () => {
    // Its own test rather than a second state in the one above: money HAS
    // arrived here, so this is the case an operator is most likely to read as
    // close enough, and it is the one the ledger says is not settled.
    const { prisma, service } = build();
    prisma.payment.findMany.mockResolvedValue(ledger(PaymentState.PARTIELLEMENT_RECU));

    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('accepts a VALIDE payment beside a refused one', async () => {
    // A rejected first attempt followed by a settled second is an ordinary
    // history, and a guard reading only the newest row would refuse it.
    const { prisma, service } = build();
    prisma.payment.findMany.mockResolvedValue(ledger(PaymentState.REJETE, PaymentState.VALIDE));

    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).resolves.toBeDefined();
  });

  it('writes nothing and tells nobody when it refuses', async () => {
    // The refusal is what matters; the ordering is what matters in practice,
    // because the email tells a client their money arrived.
    const { prisma, email, service } = build();
    prisma.payment.findMany.mockResolvedValue([]);

    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).rejects.toThrow();
    expect(prisma.landReservation.update).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('names every payment and its state in the refusal', async () => {
    // "Not validated" leaves the operator with three different next actions.
    // Which one applies is exactly what the states say.
    const { prisma, service } = build();
    prisma.payment.findMany.mockResolvedValue(ledger(PaymentState.ANNONCE_CLIENT));

    await service.confirmDownPayment(RESERVATION, ADMIN).catch(() => undefined);

    const i18n = (service as unknown as { i18n: { translate: jest.Mock } }).i18n;
    expect(i18n.translate).toHaveBeenCalledWith(
      'lands.reservation.acompteNotValidated',
      expect.objectContaining({
        args: { payments: `KBQ-2609-AAAA0-C (${PaymentState.ANNONCE_CLIENT})` },
      }),
    );
  });

  it('still answers the step guards before it reads the ledger', async () => {
    // An already-confirmed reservation must keep answering 409 rather than the
    // new refusal: the ledger is not the reason that call is wrong.
    const { prisma, service } = build();
    prisma.landReservation.findUnique.mockResolvedValue(
      reservation({ downPaymentConfirmed: true }),
    );

    await expect(service.confirmDownPayment(RESERVATION, ADMIN)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });
});
