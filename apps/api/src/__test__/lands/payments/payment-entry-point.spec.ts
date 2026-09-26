import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EmailService,
  PaymentChannel,
  PaymentState,
  StorageService,
  UnnamedActorError,
  PaymentPurpose,
} from '@kambriq/common';
import { PaymentsService } from '../../../lands/payments/payments.service';
import { PaymentChannelsService } from '../../../lands/payments/payment-channels.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import { LandsPrismaService } from '../../../lands/prisma/lands-prisma.service';
import {
  mockConfigService,
  mockCorePrisma,
  mockEmailService,
  mockLandsPrisma,
  mockPaymentChannels,
  mockStorageService,
} from '../../utils';

const CLIENT = '00000000-0000-4000-8000-c00000000001';
const SOMEBODY_ELSE = '00000000-0000-4000-8000-c00000000002';
const RESERVATION = 'res-1';

const reservation = (over: Record<string, unknown> = {}) => ({
  id: RESERVATION,
  clientUserId: CLIENT,
  clientName: 'Awono Test Client',
  status: 'PENDING',
  downPaymentAmount: 400000,
  payments: [],
  land: { title: 'Parcelle Douala Akwa' },
  ...over,
});

describe('G9 - the payment entry point', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;
  let core: ReturnType<typeof mockCorePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockLandsPrisma();
    core = mockCorePrisma();
    // Verified by default: these suites are about the payment machinery, not
    // about the gate, and an unverified fixture would make every one of them
    // fail for a reason none of them is testing. `payment-identification-gate.spec.ts`
    // is where the gate itself is exercised.
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });
    prisma.$queryRaw.mockResolvedValue([{ nextval: 1n }]);
    prisma.payment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'pay-1', ...data }),
    );
    prisma.paymentTransition.create.mockResolvedValue({});
    prisma.landReservation.findUnique.mockResolvedValue(reservation());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: LandsPrismaService, useValue: prisma },
        { provide: PaymentChannelsService, useValue: mockPaymentChannels() },
        { provide: EmailService, useValue: mockEmailService() },
        { provide: StorageService, useValue: mockStorageService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: CorePrismaService, useValue: core },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  // ----- CREATION IS A NAMED ACT, AND IT WRITES ITS OWN AUDIT ROW ----- //

  describe('creation is a named act', () => {
    it('writes the audit row that records the payment coming into existence', async () => {
      /**
       * G7's assessment found every trail began at the payment's *second* state:
       * the only rows with `fromState IS NULL` anywhere were the ones the G1
       * migration backfill wrote. A trail that cannot say how a payment came to
       * exist does not answer the first question asked of it.
       */
      await service.requestPaymentForReservation(CLIENT, RESERVATION);

      const audit = prisma.paymentTransition.create.mock.calls[0][0] as {
        data: {
          fromState: null;
          toState: string;
          actorUserId: string;
          reason: string;
          paymentId: string;
        };
      };
      expect(audit.data.fromState).toBeNull();
      expect(audit.data.toState).toBe(PaymentState.INITIE);
      expect(audit.data.actorUserId).toBe(CLIENT);
      expect(audit.data.reason).toContain(RESERVATION);
      expect(audit.data.paymentId).toBe('pay-1');
    });

    it('writes the payment and its audit row in one transaction', async () => {
      // Not two writes with a window between them: a crash in that window leaves
      // a payment with no history and nobody able to say where it came from.
      await service.requestPaymentForReservation(CLIENT, RESERVATION);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(typeof prisma.$transaction.mock.calls[0][0]).toBe('function');
    });

    it('refuses to create a payment for a system actor', async () => {
      await expect(
        service.createPayment({
          purpose: PaymentPurpose.ACOMPTE,
          reservationId: RESERVATION,
          amountDue: 400_000n,
          currency: 'XAF',
          createdBy: 'system',
          reason: 'because',
        }),
      ).rejects.toBeInstanceOf(UnnamedActorError);

      // Refused before the sequence was touched, so a refused creation does not
      // burn a reference.
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('refuses to create a payment with no reason', async () => {
      await expect(
        service.createPayment({
          purpose: PaymentPurpose.ACOMPTE,
          reservationId: RESERVATION,
          amountDue: 400_000n,
          currency: 'XAF',
          createdBy: CLIENT,
          reason: '   ',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('assigns the reference at creation, as G2 requires', async () => {
      const res = await service.requestPaymentForReservation(CLIENT, RESERVATION);
      expect(res.reference).toMatch(/^KBQ-\d{4}-.{5}-.$/);
    });
  });

  // ----- THE CLIENT ASKS. THE CLIENT DOES NOT SAY HOW MUCH. ----- //

  describe('the amount comes from the reservation, never from the caller', () => {
    it('reads the acompte off the reservation row', async () => {
      const res = await service.requestPaymentForReservation(CLIENT, RESERVATION);

      expect(res.amountDue).toBe('400000');
      expect(res.currency).toBe('XAF');
      const data = (prisma.payment.create.mock.calls[0][0] as { data: { amountDue: bigint } }).data;
      expect(data.amountDue).toBe(400_000n);
    });

    it('takes no amount on the wire at all', () => {
      /**
       * A caller who can name their own `amountDue` can decide what they owe.
       * Asserted against the signature rather than by trying to pass one, because
       * the point is that there is nowhere to put it.
       */
      const src = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'controllers', 'lands-client.controller.ts'),
        'utf8',
      );
      // The handler's own signature. Slicing to the first `)` would stop inside
      // `@CurrentUser()`, and slicing to the first `}` would stop inside the
      // `@ApiResponse({...})` above it - both would pass while reading nothing.
      const signature = src.split('\n').find((l) => l.includes('async requestPayment('));

      expect(signature).toBeDefined();
      expect(signature).not.toContain('@Body');
      expect(signature).toContain('@CurrentUser()');
      expect(signature).toContain("@Param('id')");
    });

    it('rounds the Float acompte the same way the G1 migration did', async () => {
      // `downPaymentAmount` is the quarantined Float. A payment created here and
      // a payment backfilled by the migration must agree on the whole franc.
      prisma.landReservation.findUnique.mockResolvedValue(
        reservation({ downPaymentAmount: 400000.6 }),
      );
      const res = await service.requestPaymentForReservation(CLIENT, RESERVATION);
      expect(res.amountDue).toBe('400001');
    });
  });

  // ----- OWNERSHIP, AND THE STATES THAT REFUSE ----- //

  describe('who may ask', () => {
    it("refuses somebody else's reservation", async () => {
      await expect(
        service.requestPaymentForReservation(SOMEBODY_ELSE, RESERVATION),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it('refuses a reservation that does not exist', async () => {
      prisma.landReservation.findUnique.mockResolvedValue(null);
      await expect(
        service.requestPaymentForReservation(CLIENT, RESERVATION),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses a cancelled reservation', async () => {
      prisma.landReservation.findUnique.mockResolvedValue(reservation({ status: 'CANCELLED' }));
      await expect(
        service.requestPaymentForReservation(CLIENT, RESERVATION),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a reservation carrying no acompte, and says it is not the client’s to fix', async () => {
      prisma.landReservation.findUnique.mockResolvedValue(reservation({ downPaymentAmount: null }));
      await expect(service.requestPaymentForReservation(CLIENT, RESERVATION)).rejects.toThrow(
        /not something the client can fix/,
      );
    });
  });

  // ----- CLICKING TWICE MUST NOT COST TWO ACOMPTES ----- //

  describe('one live payment per reservation', () => {
    it('returns the existing payment rather than creating a second', async () => {
      prisma.landReservation.findUnique.mockResolvedValue(
        reservation({
          payments: [
            {
              id: 'pay-existing',
              reference: 'KBQ-2609-ABCDE-F',
              state: 'INSTRUCTIONS_ENVOYEES',
              purpose: 'ACOMPTE',
            },
          ],
        }),
      );
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-existing',
        reference: 'KBQ-2609-ABCDE-F',
        amountDue: 400_000n,
        currency: 'XAF',
        state: 'INSTRUCTIONS_ENVOYEES',
      });

      const res = await service.requestPaymentForReservation(CLIENT, RESERVATION);

      expect(res.id).toBe('pay-existing');
      expect(prisma.payment.create).not.toHaveBeenCalled();
      // And no second reference was burned off the sequence.
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('a settled deposit never opens a second deposit - VALIDE is terminal but it is not replaceable', async () => {
      /**
       * The first version of this check used `TERMINAL_STATES`, which contains
       * `VALIDE`, and a client whose acompte was settled could create a second
       * one. Since G20 a settled deposit leads to the balance instead, which
       * is not due before the documents step: the request is refused and
       * nothing is created (the balance itself is in balance-on-ledger.spec.ts).
       */
      prisma.landReservation.findUnique.mockResolvedValue(
        reservation({
          payments: [
            { id: 'pay-paid', reference: 'KBQ-2609-ABCDE-F', state: 'VALIDE', purpose: 'ACOMPTE' },
          ],
          documentsReceivedAt: null,
          land: { title: 'Parcelle Douala Akwa', totalPrice: 8_000_000 },
        }),
      );

      await expect(service.requestPaymentForReservation(CLIENT, RESERVATION)).rejects.toThrow(
        BadRequestException,
      );
      expect(prisma.payment.create).not.toHaveBeenCalled();
    });

    it.each(['ANNULE', 'EXPIRE', 'REJETE'])(
      'a payment that ended in %s does not block a new one',
      async (state) => {
        prisma.landReservation.findUnique.mockResolvedValue(
          reservation({
            payments: [
              { id: 'pay-dead', reference: 'KBQ-2609-ABCDE-F', state, purpose: 'ACOMPTE' },
            ],
          }),
        );

        const res = await service.requestPaymentForReservation(CLIENT, RESERVATION);

        expect(res.id).toBe('pay-1');
        expect(prisma.payment.create).toHaveBeenCalledTimes(1);
      },
    );
  });

  // ----- SENDING IS A SEPARATE ACT ----- //

  describe('asking for the instructions is a separate call', () => {
    it('creating a payment sends nothing', async () => {
      const email = mockEmailService();
      const module = await Test.createTestingModule({
        providers: [
          PaymentsService,
          { provide: LandsPrismaService, useValue: prisma },
          { provide: PaymentChannelsService, useValue: mockPaymentChannels() },
          { provide: EmailService, useValue: email },
          { provide: StorageService, useValue: mockStorageService() },
          { provide: ConfigService, useValue: mockConfigService() },
          { provide: CorePrismaService, useValue: core },
        ],
      }).compile();

      await module.get(PaymentsService).requestPaymentForReservation(CLIENT, RESERVATION);

      // The payment exists and the client has been told nothing yet. That is the
      // same separation as recording an encaissement without validating it.
      expect(email.send).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).toHaveBeenCalledTimes(1);
    });

    it("refuses to set somebody else's preference", async () => {
      prisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        reservationId: RESERVATION,
        reference: 'KBQ-2609-ABCDE-F',
        state: PaymentState.INITIE,
      });
      prisma.landReservation.findUnique.mockResolvedValue(reservation());

      await expect(
        service.setPreferredChannel(SOMEBODY_ELSE, 'pay-1', PaymentChannel.OMO),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('the client has no way to reach INSTRUCTIONS_ENVOYEES at all', () => {
      /**
       * v03: *"on n'envoie pas les moyens de paiement a qui clique"*. The
       * client's own click used to send an email listing every channel; that
       * method is gone, and the client controller has no route that transitions
       * anything.
       */
      const controller = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'controllers', 'lands-client.controller.ts'),
        'utf8',
      );
      // Routes and calls, not prose: the word "instructions" legitimately
      // appears in the description explaining that this is *not* where they are
      // sent, and a sweep that cannot tell the two apart reports the
      // explanation as the defect.
      const routes = [...controller.matchAll(/@(Get|Post|Patch|Delete)\('([^']*)'\)/g)].map(
        (m) => m[2],
      );
      expect(routes).not.toContain('payments/:id/instructions');
      expect(controller).not.toContain('this.payments.sendInstructions');
      expect(controller).not.toContain('requestInstructions');
      expect(Object.getOwnPropertyNames(Object.getPrototypeOf(service))).not.toContain(
        'requestInstructions',
      );
    });
  });
});
