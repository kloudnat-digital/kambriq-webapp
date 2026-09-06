import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  EmailService,
  isTransactional,
  PaymentState,
  SUPPRESSIBLE_TEMPLATES,
} from '@kambriq/common';
import { PaymentsService } from '../../../lands/payments/payments.service';
import { LandsPrismaService } from '../../../lands/prisma/lands-prisma.service';
import { PaymentChannelsService } from '../../../lands/payments/payment-channels.service';
import { mockEmailService, mockLandsPrisma, mockPaymentChannels } from '../../utils';

const REFERENCE = 'KBQ-2609-J8ZD9-Y';
const ADMIN = '00000000-0000-4000-8000-b00000000001';
const TO = { email: 'client@maildrop.cc', clientName: 'Alphonse', lang: 'fr' };
const CONTEXT = { subject: 'Parcelle Douala 1', actorUserId: ADMIN };

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
  let email: ReturnType<typeof mockEmailService>;
  let channels: ReturnType<typeof mockPaymentChannels>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockLandsPrisma();
    email = mockEmailService();
    channels = mockPaymentChannels();

    prisma.payment.findUnique.mockResolvedValue(payment());
    prisma.payment.update.mockResolvedValue({});
    prisma.paymentTransition.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: LandsPrismaService, useValue: prisma },
        { provide: PaymentChannelsService, useValue: channels },
        { provide: EmailService, useValue: email },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  // ----- (b) THE A11 BARRIER ----- //

  describe('(b) the instruction and the reminder are transactional', () => {
    it.each(['paymentInstructions', 'paymentReminder'])(
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

    it.each(['paymentInstructions', 'paymentReminder'])(
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
      await service.sendInstructions('pay-1', TO, CONTEXT);
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
      channels.get.mockRejectedValue(
        new Error('Payment channel details are incomplete: 2 parameter(s) unusable.'),
      );

      await expect(service.sendInstructions('pay-1', TO, CONTEXT)).rejects.toThrow(/incomplete/);

      // Nothing sent, and nothing moved. A message with a blank IBAN tells
      // somebody to transfer money into nothing.
      expect(email.send).not.toHaveBeenCalled();
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('every channel detail reaches the message', async () => {
      await service.sendInstructions('pay-1', TO, CONTEXT);

      const args = (email.send.mock.calls[0][0] as { args: Record<string, string> }).args;
      const expected = await mockPaymentChannels().get();

      for (const [field, value] of Object.entries(expected)) {
        expect(args[field]).toBe(value);
      }
      // And none of them is blank, which is the property that matters.
      for (const [field] of Object.entries(expected)) {
        expect(String(args[field]).trim()).not.toBe('');
      }
    });

    it('carries the reference, the amount, the currency and the deadline', async () => {
      await service.sendInstructions('pay-1', TO, CONTEXT);

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
      // A date a person acts on, not an ISO stamp.
      expect(args['deadline']).toBe('6 octobre 2026');
      expect(args['subject']).toBe('Parcelle Douala 1');
    });

    it('refuses a payment that has no reference at all', async () => {
      // G1 backfilled rows predate G2's generator. Asking somebody to pay
      // against nothing is worse than not asking.
      prisma.payment.findUnique.mockResolvedValue(payment({ reference: null }));

      await expect(service.sendInstructions('pay-1', TO, CONTEXT)).rejects.toThrow(
        BadRequestException,
      );
      expect(email.send).not.toHaveBeenCalled();
    });
  });

  // ----- (d) STATE AND REALITY CANNOT DISAGREE ----- //

  describe('(d) a failed send never leaves the payment in INSTRUCTIONS_ENVOYEES', () => {
    it('sends first, and only then transitions', async () => {
      await service.sendInstructions('pay-1', TO, CONTEXT);

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

      await expect(service.sendInstructions('pay-1', TO, CONTEXT)).rejects.toThrow(
        'queue unreachable',
      );

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('moves to INSTRUCTIONS_ENVOYEES when the send succeeded', async () => {
      const result = await service.sendInstructions('pay-1', TO, CONTEXT);

      expect(result.state).toBe(PaymentState.INSTRUCTIONS_ENVOYEES);
      expect(result.reference).toBe(REFERENCE);
      const audit = prisma.paymentTransition.create.mock.calls[0][0] as {
        data: { toState: string; actorUserId: string; reason: string };
      };
      expect(audit.data.toState).toBe(PaymentState.INSTRUCTIONS_ENVOYEES);
      expect(audit.data.actorUserId).toBe(ADMIN);
      expect(audit.data.reason).toContain(TO.email);
    });

    it('goes through G1 guard, so an illegal transition is still refused', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment({ state: PaymentState.VALIDE }));

      await expect(service.sendInstructions('pay-1', TO, CONTEXT)).rejects.toThrow(
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

    it('repeats the instructions rather than referring to them', async () => {
      // A person who needs a reminder is a person who cannot find the first
      // message.
      await service.sendReminder('pay-1', TO, { subject: CONTEXT.subject });

      const args = (email.send.mock.calls[0][0] as { args: Record<string, string> }).args;
      expect(args['bankIban']).toBeTruthy();
      expect(args['mobileMoneyNumber']).toBeTruthy();
      expect(args['notaryName']).toBeTruthy();
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
