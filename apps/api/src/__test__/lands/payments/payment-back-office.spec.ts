import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EmailService, PaymentChannel, PaymentState, StorageService } from '@kambriq/common';
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

const ADMIN = '00000000-0000-4000-8000-b00000000001';
const RECORDER = '00000000-0000-4000-8000-b00000000004';

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  reference: 'KBQ-2609-J8ZD9-Y',
  reservationId: 'res-1',
  currency: 'XAF',
  amountDue: 750_000n,
  state: PaymentState.PARTIELLEMENT_RECU,
  expiresAt: new Date('2026-10-06T00:00:00Z'),
  createdAt: new Date('2026-09-01T00:00:00Z'),
  ...over,
});

const receipt = (over: Record<string, unknown> = {}) => ({
  amount: 500_000n,
  currency: 'XAF',
  channel: PaymentChannel.VIR,
  receivedAt: new Date('2026-09-02T00:00:00Z'),
  evidenceUrl: 'payments/pay-1/1-proof.pdf',
  ...over,
});

describe('G4 - the back office', () => {
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
    prisma.payment.findUnique.mockResolvedValue(payment());
    prisma.payment.update.mockResolvedValue({});
    prisma.paymentTransition.create.mockResolvedValue({});
    prisma.paymentReceipt.create.mockResolvedValue({ id: 'r1' });

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

  // ----- (b) RECORDING NEVER VALIDATES ----- //

  describe('(b) recording an encaissement never validates the payment', () => {
    it('appends to the ledger and moves nothing', async () => {
      await service.recordReceipt('pay-1', receipt(), RECORDER);

      expect(prisma.paymentReceipt.create).toHaveBeenCalledTimes(1);
      // The mutation target. Recording what arrived and agreeing that it
      // settles the payment are two acts by two people with two authorities.
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('even when the receipt completes the amount due', async () => {
      // The tempting shortcut: "the balance is zero, so validate it". That is
      // a business event crossing a committing boundary by itself - the
      // KCA_CERTIFIED defect, one boundary further along, where the boundary
      // commits money.
      await service.recordReceipt('pay-1', receipt({ amount: 750_000n }), RECORDER);

      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('validating is a separate call, with its own actor and reason', async () => {
      prisma.paymentReceipt.findMany.mockResolvedValue([{ amount: 750_000n }]);

      const result = await service.validate('pay-1', {
        actorUserId: ADMIN,
        reason: 'reçus vérifiés contre le relevé bancaire',
        evidenceReceiptId: 'r1',
      });

      expect(result.state).toBe(PaymentState.VALIDE);
      const audit = prisma.paymentTransition.create.mock.calls[0][0] as {
        data: { toState: string; actorUserId: string; reason: string; evidenceReceiptId: string };
      };
      expect(audit.data.toState).toBe(PaymentState.VALIDE);
      expect(audit.data.actorUserId).toBe(ADMIN);
      expect(audit.data.reason).toContain('relevé bancaire');
      expect(audit.data.evidenceReceiptId).toBe('r1');
    });

    it('refuses to validate without a reason, through G1 guard', async () => {
      await expect(
        service.validate('pay-1', { actorUserId: ADMIN, reason: '   ' }),
      ).rejects.toThrow(/explicit act by a named person/);
      expect(prisma.payment.update).not.toHaveBeenCalled();
    });
  });

  // ----- (c) THE TOTAL IS NEVER WRITABLE ----- //

  describe('(c) the computed total cannot be written, including through the new endpoints', () => {
    it('the model has no column to write', () => {
      const schema = readFileSync(
        join(__dirname, '..', '..', '..', '..', '..', '..', 'prisma', 'lands', 'schema.prisma'),
        'utf8',
      );
      const model = schema.slice(
        schema.indexOf('model Payment {'),
        schema.indexOf('\n}', schema.indexOf('model Payment {')),
      );
      for (const forbidden of ['totalReceived', 'amountReceived', 'balance', 'outstanding']) {
        expect(model).not.toContain(forbidden);
      }
    });

    it('the back-office read computes it and never selects it', async () => {
      prisma.$transaction.mockResolvedValue([
        [{ ...payment(), receipts: [{ amount: 300_000n }, { amount: 200_000n }] }],
        1,
      ]);

      const res = await service.listForBackOffice({
        page: 1,
        limit: 20,
        sort: 'createdAt',
        order: 'desc',
      });

      expect(res.data[0].amountReceived).toBe('500000');
      expect(res.data[0].outstanding).toBe('250000');
    });

    it('the detail read computes it from the ledger it returns', async () => {
      prisma.payment.findUnique.mockResolvedValue({
        ...payment(),
        receipts: [
          receipt({ id: 'r1', amount: 500_000n }),
          receipt({ id: 'r2', amount: 100_000n }),
        ],
        transitions: [],
      });

      const res = await service.findForBackOffice('pay-1');

      expect(res.amountReceived).toBe('600000');
      expect(res.outstanding).toBe('150000');
      // And the figure is derivable from what was returned, so a reader can
      // check it rather than trust it.
      const summed = res.receipts.reduce((a, r) => a + BigInt(r.amount), BigInt(0));
      expect(summed.toString()).toBe(res.amountReceived);
    });

    it('the controller exposes no route that writes a total', () => {
      const controller = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'controllers', 'payments-admin.controller.ts'),
        'utf8',
      );
      expect(controller).toContain('class PaymentsAdminController');
      for (const forbidden of ['totalReceived', 'setTotal', 'amountReceived:']) {
        expect(controller).not.toContain(forbidden);
      }
    });
  });

  // ----- (d) A RECEIPT WITHOUT A PROOF IS REFUSED ----- //

  describe('(d) a receipt without a proof is refused', () => {
    it.each([
      ['', 'empty'],
      ['   ', 'whitespace'],
    ])('refuses a %s evidence key (%s)', async (url) => {
      await expect(
        service.recordReceipt('pay-1', receipt({ evidenceUrl: url }), RECORDER),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentReceipt.create).not.toHaveBeenCalled();
    });

    it('the historic exception cannot be used by a new receipt', async () => {
      // INCONNU_HISTORIQUE exists for the rows G1 backfilled, which genuinely
      // have no channel and no proof. A new receipt claiming it would be
      // inventing an exemption from the evidence rule.
      await expect(
        service.recordReceipt('pay-1', receipt({ channel: PaymentChannel.HIST }), RECORDER),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.paymentReceipt.create).not.toHaveBeenCalled();
    });

    it('the DTO refuses it too, a boundary earlier', () => {
      const dto = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'payments', 'dto', 'payments.dto.ts'),
        'utf8',
      );
      expect(dto).toContain('RECORDABLE_CHANNELS');
      expect(dto).toContain('A receipt requires its proof.');
    });

    it('the database CHECK is the backstop, and still confines the exception', () => {
      const migration = readFileSync(
        join(
          __dirname,
          '..',
          '..',
          '..',
          '..',
          '..',
          '..',
          'prisma',
          'lands',
          'migrations',
          '20260906190000_g1_payment_model',
          'migration.sql',
        ),
        'utf8',
      );
      expect(migration).toContain('PaymentReceipt_evidence_required');
      expect(migration).toContain(
        '"evidenceUrl" IS NOT NULL OR "channel" = \'INCONNU_HISTORIQUE\'',
      );
    });

    it('records a receipt that has its proof', async () => {
      const res = await service.recordReceipt('pay-1', receipt(), RECORDER);

      expect(res.id).toBe('r1');
      const data = (
        prisma.paymentReceipt.create.mock.calls[0][0] as { data: Record<string, unknown> }
      ).data;
      expect(data['evidenceUrl']).toBe('payments/pay-1/1-proof.pdf');
      expect(data['recordedBy']).toBe(RECORDER);
      // The real date of receipt, not the date of entry. `recordedAt` is the
      // server's and is a different fact.
      expect(data['receivedAt']).toEqual(new Date('2026-09-02T00:00:00Z'));
    });
  });

  // ----- PROOF UPLOAD ----- //

  // ----- (e) A DEPOSIT NAMES WHO PAID ----- //

  describe('(e) a deposit names the person who actually paid', () => {
    /**
     * v03 section 6: *"Un virement part du compte du client et porte son nom ;
     * un depot se fait au guichet, en especes, souvent par un tiers - un parent
     * a Douala, un ami de passage. La preuve est un bordereau de versement et
     * non un avis de virement, et le nom sur le bordereau n'est pas forcement
     * celui du client."*
     *
     * Without it the back office holds a slip bearing a name it does not
     * recognise and cannot attach it to anything.
     */
    it('refuses a DEPO receipt with no payer', async () => {
      await expect(
        service.recordReceipt(
          'pay-1',
          receipt({ channel: PaymentChannel.DEPO, paidBy: undefined }),
          RECORDER,
        ),
      ).rejects.toThrow(/must name who paid/);

      expect(prisma.paymentReceipt.create).not.toHaveBeenCalled();
    });

    it('refuses a DEPO receipt whose payer is only whitespace', async () => {
      // A field somebody pressed space in is a field nobody filled.
      await expect(
        service.recordReceipt(
          'pay-1',
          receipt({ channel: PaymentChannel.DEPO, paidBy: '   ' }),
          RECORDER,
        ),
      ).rejects.toThrow(/must name who paid/);
    });

    it('records a DEPO receipt that names the depositor', async () => {
      const res = await service.recordReceipt(
        'pay-1',
        receipt({ channel: PaymentChannel.DEPO, paidBy: 'Awono Bernadette' }),
        RECORDER,
      );

      expect(res.id).toBe('r1');
      const data = (
        prisma.paymentReceipt.create.mock.calls[0][0] as { data: Record<string, unknown> }
      ).data;
      expect(data['paidBy']).toBe('Awono Bernadette');
      expect(data['channel']).toBe(PaymentChannel.DEPO);
    });

    it('does not demand a payer on channels where the client is the payer', async () => {
      // A transfer leaves the client's own account and carries their name.
      // Demanding the field everywhere would have people retype the client's
      // own name until they stopped reading it.
      const res = await service.recordReceipt(
        'pay-1',
        receipt({ channel: PaymentChannel.VIR }),
        RECORDER,
      );
      expect(res.id).toBe('r1');
    });

    it('the historic exception cannot be used to bypass it', async () => {
      /**
       * `HIST` is the one channel that may omit its proof, so it is the obvious
       * thing to reach for to skip a rule. It is refused as an input outright -
       * so there is no channel that skips both the payer and the proof, and no
       * way to record a deposit as "historic" to avoid naming who paid.
       */
      await expect(
        service.recordReceipt(
          'pay-1',
          receipt({ channel: PaymentChannel.HIST, evidenceUrl: undefined, paidBy: undefined }),
          RECORDER,
        ),
      ).rejects.toThrow(/INCONNU_HISTORIQUE|HIST/);

      expect(prisma.paymentReceipt.create).not.toHaveBeenCalled();
    });

    it('the database is the backstop for both rules', () => {
      const migration = readFileSync(
        join(
          __dirname,
          '..',
          '..',
          '..',
          '..',
          '..',
          '..',
          'prisma',
          'lands',
          'migrations',
          '20260907090000_g11_channels_gate_and_payer',
          'migration.sql',
        ),
        'utf8',
      );
      // A service guards its callers; a constraint guards the console too.
      expect(migration).toContain('PaymentReceipt_depo_requires_payer');
      expect(migration).toContain(
        `CHECK ("channel" <> 'DEPO' OR ("paidBy" IS NOT NULL AND btrim("paidBy") <> ''))`,
      );
      // And the proof rule still confines its exception to the same one channel.
      expect(migration).toContain(`CHECK ("evidenceUrl" IS NOT NULL OR "channel" = 'HIST')`);
    });
  });

  describe('proofs are private objects with constrained types', () => {
    it('refuses a content type that is not a document or a photograph of one', async () => {
      await expect(
        service.getProofUploadUrl('pay-1', {
          fileName: 'x.exe',
          contentType: 'application/x-msdownload',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each(['application/pdf', 'image/jpeg', 'image/png', 'image/heic'])(
      'accepts %s',
      async (contentType) => {
        const res = await service.getProofUploadUrl('pay-1', { fileName: 'p.pdf', contentType });
        expect(res.key).toMatch(/^payments\/pay-1\//);
        expect(res.uploadUrl).toBeTruthy();
      },
    );

    it('sanitises the file name into the key', async () => {
      const res = await service.getProofUploadUrl('pay-1', {
        fileName: '../../etc/passwd; rm -rf.pdf',
        contentType: 'application/pdf',
      });
      expect(res.key).not.toContain('..');
      expect(res.key).not.toContain('/etc/');
      expect(res.key).toMatch(/^payments\/pay-1\/\d+-[A-Za-z0-9._-]+$/);
    });
  });

  // ----- MOVING STATE IS ITS OWN ACT, AND ITS RBAC IS DERIVED ----- //

  describe('advancing a payment is a named act, and committing states need ADMIN_GLOBAL', () => {
    /**
     * The back office has to be able to walk INSTRUCTIONS_ENVOYEES to VALIDE,
     * which is five states. Without a call for the steps in between, the screen
     * offered "validate" from a state the machine refuses - correctly - and the
     * payment was stuck with money in its ledger and nowhere to go.
     *
     * Who may take each step is read from `COMMITTING_STATES`, the same set the
     * deliberateness guard uses, so a state added there tomorrow is protected
     * here the same day.
     */
    it('a lands admin may take a step that commits nothing', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        payment({ state: PaymentState.INSTRUCTIONS_ENVOYEES }),
      );

      const result = await service.transitionAsAdmin('pay-1', PaymentState.ANNONCE_CLIENT, {
        actorUserId: RECORDER,
        reason: 'client called',
        roles: ['ADMIN_LANDS'],
      });

      expect(result.state).toBe(PaymentState.ANNONCE_CLIENT);
      expect(prisma.paymentTransition.create).toHaveBeenCalledTimes(1);
    });

    it('a lands admin may NOT reach a state that commits money', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment({ state: PaymentState.EN_VERIFICATION }));

      await expect(
        service.transitionAsAdmin('pay-1', PaymentState.PARTIELLEMENT_RECU, {
          actorUserId: RECORDER,
          reason: 'two receipts are in',
          roles: ['ADMIN_LANDS'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // Refused before anything was written, not after.
      expect(prisma.payment.update).not.toHaveBeenCalled();
      expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
    });

    it('a global admin may reach a state that commits money', async () => {
      prisma.payment.findUnique.mockResolvedValue(payment({ state: PaymentState.EN_VERIFICATION }));

      const result = await service.transitionAsAdmin('pay-1', PaymentState.PARTIELLEMENT_RECU, {
        actorUserId: ADMIN,
        reason: 'two receipts are in',
        roles: ['ADMIN_GLOBAL'],
      });

      expect(result.state).toBe(PaymentState.PARTIELLEMENT_RECU);
    });

    it('moves state and writes no money', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        payment({ state: PaymentState.INSTRUCTIONS_ENVOYEES }),
      );

      await service.transitionAsAdmin('pay-1', PaymentState.ANNONCE_CLIENT, {
        actorUserId: RECORDER,
        reason: 'client called',
        roles: ['ADMIN_LANDS'],
      });

      // The other half of the pair proved in (b): recording never validates,
      // and moving never records.
      expect(prisma.paymentReceipt.create).not.toHaveBeenCalled();
    });

    it('a step the transition table forbids is refused whoever asks', async () => {
      prisma.payment.findUnique.mockResolvedValue(
        payment({ state: PaymentState.INSTRUCTIONS_ENVOYEES }),
      );

      // This is the exact jump the screen offered and the machine refused.
      await expect(
        service.transitionAsAdmin('pay-1', PaymentState.VALIDE, {
          actorUserId: ADMIN,
          reason: 'looks paid',
          roles: ['ADMIN_GLOBAL'],
        }),
      ).rejects.toThrow(/INSTRUCTIONS_ENVOYEES -> VALIDE/);

      expect(prisma.payment.update).not.toHaveBeenCalled();
    });

    it('the roles that may reach each state come from COMMITTING_STATES, not a second list', async () => {
      // A hand-written list of "the dangerous ones" is a second source of truth
      // that stops agreeing the first time either changes.
      const src = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'payments', 'payments.service.ts'),
        'utf8',
      );
      const guard = /transitionAsAdmin[\s\S]*?\n {2}}/.exec(src)?.[0] ?? '';
      expect(guard).toContain('COMMITTING_STATES.has(to)');
      for (const state of ['PARTIELLEMENT_RECU', 'VALIDE', 'REJETE', 'ANNULE']) {
        expect(guard).not.toContain(`'${state}'`);
      }
    });
  });

  describe('the four-eyes seam', () => {
    it('exists on the validate path, where the money is committed', () => {
      const src = readFileSync(
        join(__dirname, '..', '..', '..', 'lands', 'payments', 'payments.service.ts'),
        'utf8',
      );
      // The rule is deferred; the seam is not. It sits before the transition,
      // so adding it later is a guard rather than a rewrite.
      expect(src).toContain('assertFourEyesIfRequired');
      const validate = src.slice(
        src.indexOf('async validate('),
        src.indexOf('async validate(') + 900,
      );
      expect(validate).toContain('assertFourEyesIfRequired');
      expect(validate.indexOf('assertFourEyesIfRequired')).toBeLessThan(
        validate.indexOf('this.transition('),
      );
    });
  });
});
