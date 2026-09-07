import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EmailService,
  isTransactional,
  PaymentChannel,
  PaymentState,
  SUPPRESSIBLE_TEMPLATES,
  StorageService,
} from '@kambriq/common';
import { PaymentsService } from '../../../lands/payments/payments.service';
import { LandsPrismaService } from '../../../lands/prisma/lands-prisma.service';
import { PaymentChannelsService } from '../../../lands/payments/payment-channels.service';
import { CorePrismaService } from '../../../core/prisma/core-prisma.service';
import {
  mockEmailService,
  mockLandsPrisma,
  mockPaymentChannels,
  mockConfigService,
  mockCorePrisma,
  mockStorageService,
} from '../../utils';

const REFERENCE = 'KBQ-2609-J8ZD9-Y';
const ADMIN = '00000000-0000-4000-8000-b00000000001';
const TO = { email: 'client@maildrop.cc', clientName: 'Alphonse', lang: 'fr' };
const CONTEXT = { subject: 'Parcelle Douala 1', actorUserId: ADMIN };

/**
 * v03 moved the send: it is the back office's act, after identification, with a
 * channel chosen. `sendInstructions` therefore takes the decision rather than
 * the recipient - the address and the name are read from the reservation and
 * the account, not passed in by whoever calls.
 */
const SEND = {
  actorUserId: ADMIN,
  channel: PaymentChannel.VIR,
  reason: 'Client bancarise, virement convenu',
};

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  reference: REFERENCE,
  reservationId: 'res-1',
  currency: 'XAF',
  amountDue: 750_000n,
  state: PaymentState.INITIE,
  expiresAt: new Date('2026-10-06T00:00:00Z'),
  ...over,
});

describe('G3 - payment instructions and reminders', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;
  let core: ReturnType<typeof mockCorePrisma>;
  let email: ReturnType<typeof mockEmailService>;
  let channels: ReturnType<typeof mockPaymentChannels>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockLandsPrisma();
    core = mockCorePrisma();
    // Verified by default: these suites are about the payment machinery, not
    // about the gate, and an unverified fixture would make every one of them
    // fail for a reason none of them is testing. `payment-identification-gate.spec.ts`
    // is where the gate itself is exercised.
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });
    email = mockEmailService();
    channels = mockPaymentChannels();

    prisma.payment.findUnique.mockResolvedValue(payment());
    prisma.landReservation.findUnique.mockResolvedValue({
      clientUserId: 'client-1',
      clientName: 'Alphonse',
      land: { title: 'Parcelle Douala 1' },
    });
    core.user.findUnique.mockResolvedValue({
      email: TO.email,
      preferredLanguage: 'fr',
    });
    prisma.payment.update.mockResolvedValue({});
    prisma.paymentTransition.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: LandsPrismaService, useValue: prisma },
        { provide: PaymentChannelsService, useValue: channels },
        { provide: EmailService, useValue: email },
        { provide: StorageService, useValue: mockStorageService() },
        { provide: ConfigService, useValue: mockConfigService() },
        { provide: CorePrismaService, useValue: core },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  // ----- (b) THE A11 BARRIER ----- //

  describe('(b) the instruction and the reminder are transactional', () => {
    it.each(['paymentInstructionsAvailable', 'paymentReminder'])(
      '%s is not in the suppressible allow-list',
      (template) => {
        // A11 made the allow-list fail safe: an unclassified template is
        // transactional. These two carry a reference, an amount and a deadline.
        // Adding them here would let a notification preference silently stop a
        // client learning how to pay.
        expect(SUPPRESSIBLE_TEMPLATES.has(template as never)).toBe(false);
        expect(isTransactional(template as never)).toBe(true);
      },
    );

    it.each(['paymentInstructionsAvailable', 'paymentReminder'])(
      'sendUpdate refuses %s outright',
      async (template) => {
        const real = new EmailService({ add: jest.fn() } as never);

        await expect(
          real.sendUpdate(
            { to: TO.email, template: template as never, lang: 'fr', args: {} },
            null,
          ),
        ).rejects.toThrow(/Refusing to route the transactional template/);
      },
    );

    it('both go through send, and the service never calls sendUpdate', async () => {
      await service.sendInstructions('pay-1', SEND);
      await service.sendReminder('pay-1', TO, { subject: CONTEXT.subject });

      expect(email.send).toHaveBeenCalledTimes(2);
      expect(email.sendUpdate).not.toHaveBeenCalled();
    });

    it('the source contains no route from these templates to sendUpdate', () => {
      const src = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'payments', 'payments.service.ts'),
        'utf8',
      );
      expect(src).toContain('class PaymentsService');
      expect(src).not.toMatch(/sendUpdate/);
    });
  });

  // ----- (c) NO BLANK WHERE AN ACCOUNT NUMBER BELONGS ----- //

  describe('(c) a message cannot be built with a missing channel detail', () => {
    it('does not send when the channel details cannot be read', async () => {
      channels.detailsFor.mockRejectedValue(
        new Error('Payment channel details are incomplete: 2 parameter(s) unusable.'),
      );

      await expect(service.sendInstructions('pay-1', SEND)).rejects.toThrow(/incomplete/);

      // Nothing sent, and nothing moved. A message with a blank IBAN tells
      // somebody to transfer money into nothing.
      expect(email.send).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('reads only the chosen channel, and reads it before writing anything', async () => {
      await service.sendInstructions('pay-1', SEND);

      // v03 4d: "Le message ne porte que les coordonnees de ce canal."
      expect(channels.detailsFor).toHaveBeenCalledWith(PaymentChannel.VIR);
      expect(channels.detailsFor).toHaveBeenCalledTimes(1);
    });

    it('no channel detail reaches the email at all', async () => {
      /**
       * **This assertion is the inverse of the one it replaced.**
       *
       * Until v03 this suite asserted "every channel detail reaches the
       * message", and it passed - because the message carried the bank account,
       * the mobile money number and the notary's address to anybody who clicked.
       * v03 4d makes the email a notification: the coordinates live on the
       * client's own page, behind their authentication.
       *
       * A test that asserts the presence of a thing is one edit away from being
       * a test that requires it.
       */
      await service.sendInstructions('pay-1', SEND);

      const args = (email.send.mock.calls[0][0] as { args: Record<string, string> }).args;
      const coordinates = await mockPaymentChannels().detailsFor(PaymentChannel.VIR);

      for (const value of Object.values(coordinates)) {
        expect(JSON.stringify(args)).not.toContain(value);
      }
      // What it carries instead: the label, and a link to where they live.
      expect(args['channelLabel']).toBe('Virement bancaire');
      expect(args['url']).toContain('/mylands/payment/');
    });

    it('carries the reference, the amount, the currency and the deadline', async () => {
      await service.sendInstructions('pay-1', SEND);

      const args = (email.send.mock.calls[0][0] as { args: Record<string, string> }).args;
      expect(args['reference']).toBe(REFERENCE);
      /**
       * The currency exactly once. The first real instruction email read
       * "750 000 FCFA XAF", because `formatXAF` appends FCFA itself and the
       * payment's own currency was appended after it.
       *
       * Compared with the group separator normalised: `Intl` uses U+202F, a
       * narrow no-break space, so an assertion typed with an ordinary space
       * fails while showing two strings that look identical. Normalising says
       * what is being compared instead of leaving the reader to spot an
       * invisible character.
       */
      expect(args['amount'].replace(/\s/g, ' ')).toBe('750 000 XAF');
      expect(args['amount']).not.toContain('FCFA');
      expect(args['amount'].match(/XAF/g)).toHaveLength(1);
      expect(args['subject']).toBe('Parcelle Douala 1');
    });

    it('refuses a payment that has no reference at all', async () => {
      // G1 backfilled rows predate G2's generator. Asking somebody to pay
      // against nothing is worse than not asking.
      prisma.payment.findUnique.mockResolvedValue(payment({ reference: null }));

      await expect(service.sendInstructions('pay-1', SEND)).rejects.toThrow(BadRequestException);
      expect(email.send).not.toHaveBeenCalled();
    });
  });

  // ----- (d) STATE AND REALITY CANNOT DISAGREE ----- //

  describe('(d) a failed send never leaves the payment in INSTRUCTIONS_ENVOYEES', () => {
    it('sends first, and only then transitions', async () => {
      await service.sendInstructions('pay-1', SEND);

      const sendOrder = email.send.mock.invocationCallOrder[0];
      const updateOrder = prisma.payment.update.mock.invocationCallOrder[0];
      expect(sendOrder).toBeLessThan(updateOrder);
    });

    it('leaves the state untouched when the send throws', async () => {
      /**
       * The mutation target. Transition-then-send produces the one state this
       * system must never be in: a payment marked as instructed that nobody was
       * ever told about. Nothing downstream can tell that apart from a client
       * ignoring their instructions - the dunning queue would chase them for a
       * message that does not exist.
       */
      email.send.mockRejectedValue(new Error('queue unreachable'));

      await expect(service.sendInstructions('pay-1', SEND)).rejects.toThrow('queue unreachable');

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('moves to INSTRUCTIONS_ENVOYEES when the send succeeded', async () => {
      const result = await service.sendInstructions('pay-1', SEND);

      expect(result.state).toBe(PaymentState.INSTRUCTIONS_ENVOYEES);
      expect(result.reference).toBe(REFERENCE);
      const audit = prisma.paymentTransition.create.mock.calls[0][0] as {
        data: { toState: string; actorUserId: string; reason: string; channel: string };
      };
      expect(audit.data.toState).toBe(PaymentState.INSTRUCTIONS_ENVOYEES);
      expect(audit.data.actorUserId).toBe(ADMIN);
      // The reason is now the operator's own words about why this channel, not
      // a generated sentence about an address: v03 4d asks the transition to
      // record "qui, quand, quel canal, et pourquoi", and the why is a human's.
      expect(audit.data.reason).toBe(SEND.reason);
      expect(audit.data.channel).toBe(PaymentChannel.VIR);
    });

    it('goes through G1 guard, so an illegal transition is still refused', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment({ state: PaymentState.VALIDE }));

      await expect(service.sendInstructions('pay-1', SEND)).rejects.toThrow(
        /Illegal payment transition/,
      );
    });
  });

  // ----- THE REMINDER ----- //

  describe('the reminder', () => {
    it('changes no state', async () => {
      await service.sendReminder('pay-1', TO, { subject: CONTEXT.subject });

      expect(email.send).toHaveBeenCalledTimes(1);
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('knows whether the deadline has passed, and says which', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        payment({ expiresAt: new Date('2020-01-01T00:00:00Z') }),
      );

      const result = await service.sendReminder('pay-1', TO, { subject: CONTEXT.subject });

      expect(result.overdue).toBe(true);
      const args = (email.send.mock.calls[0][0] as { args: Record<string, string> }).args;
      expect(args['overdue']).toBe('true');
    });

    it('repeats the reference and points at the page, and carries no coordinates', async () => {
      /**
       * **Inverted by v03.** This test used to assert that the reminder
       * contained the IBAN, the mobile money number and the notary's name -
       * "a person who needs a reminder is a person who cannot find the first
       * message". The reasoning was sound and the conclusion was wrong: it sent
       * the coordinates a second time, to people who had not opened them once.
       *
       * A person who cannot find the first message needs the *place*, which is
       * on their own page, behind their authentication, showing the channel that
       * was actually chosen for them.
       */
      await service.sendReminder('pay-1', TO, { subject: CONTEXT.subject });

      const args = (email.send.mock.calls[0][0] as { args: Record<string, string> }).args;

      expect(args['reference']).toBe(REFERENCE);
      expect(args['url']).toContain('/mylands/payment/');

      const coordinates = await mockPaymentChannels().detailsFor(PaymentChannel.VIR);
      for (const value of Object.values(coordinates)) {
        expect(JSON.stringify(args)).not.toContain(value);
      }
      expect(args['bankIban']).toBeUndefined();
      expect(args['mobileMoneyNumber']).toBeUndefined();
      expect(args['notaryName']).toBeUndefined();
    });

    it('does not schedule itself - that is G6', () => {
      const src = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'payments', 'payments.service.ts'),
        'utf8',
      );
      // No cron, no interval, no queue scheduling in this chantier.
      expect(src).not.toMatch(/@Cron|setInterval|repeat:/);
      expect(src).toContain('G6');
    });
  });
});
