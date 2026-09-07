import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  EmailService,
  IdVerificationStatus,
  PaymentChannel,
  PaymentState,
  StorageService,
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

const ADMIN = '00000000-0000-4000-8000-b00000000001';
const CLIENT = '00000000-0000-4000-8000-c00000000001';

const payment = (over: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  reference: 'KBQ-2609-J8ZD9-Y',
  reservationId: 'res-1',
  currency: 'XAF',
  amountDue: 750_000n,
  state: PaymentState.INITIE,
  preferredChannel: PaymentChannel.OMO,
  channel: null,
  expiresAt: null,
  ...over,
});

const SEND = {
  actorUserId: ADMIN,
  channel: PaymentChannel.VIR,
  reason: 'Montant eleve, virement bancaire convenu par telephone',
};

describe('G12 - no coordinates leave the system for an unidentified client', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;
  let core: ReturnType<typeof mockCorePrisma>;
  let email: ReturnType<typeof mockEmailService>;

  const build = async (identity: string) => {
    jest.clearAllMocks();
    prisma = mockLandsPrisma();
    core = mockCorePrisma();
    email = mockEmailService();

    prisma.payment.findUnique.mockResolvedValue(payment());
    prisma.payment.update.mockResolvedValue({});
    prisma.paymentTransition.create.mockResolvedValue({});
    prisma.landReservation.findUnique.mockResolvedValue({
      clientUserId: CLIENT,
      clientName: 'Awono Test Client',
      land: { title: 'Parcelle Douala Akwa' },
    });
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: identity });
    core.user.findUnique.mockResolvedValue({
      email: 'client@maildrop.cc',
      preferredLanguage: 'fr',
    });

    const module: TestingModule = await Test.createTestingModule({
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
    service = module.get(PaymentsService);
  };

  // ----- VERIFIED, NOT SUBMITTED ----- //

  it.each([
    [IdVerificationStatus.NONE, 'no document has been submitted'],
    [IdVerificationStatus.PENDING, 'a document is waiting in the review queue'],
    [IdVerificationStatus.REJECTED, 'their document was rejected'],
  ])('refuses to send when the identity is %s, and says why', async (status, expected) => {
    await build(status);

    await expect(service.sendInstructions('pay-1', SEND)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(service.sendInstructions('pay-1', SEND)).rejects.toThrow(expected);

    // Nothing sent, nothing moved, nothing written.
    expect(email.send).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
    expect(prisma.paymentTransition.create).not.toHaveBeenCalled();
  });

  it('"pending" is refused, which is the whole distinction', async () => {
    /**
     * v03 4d: *"Une piece d'identite verifiee, pas seulement deposee."*
     * `pending` means a document is sitting in a queue. It says nothing about
     * whether anybody looked at it, and a gate that accepted it would let the
     * coordinates out to whoever uploaded a photograph.
     */
    await build(IdVerificationStatus.PENDING);
    await expect(service.sendInstructions('pay-1', SEND)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('sends once the identity is verified', async () => {
    await build(IdVerificationStatus.VERIFIED);

    const res = await service.sendInstructions('pay-1', SEND);

    expect(res.state).toBe(PaymentState.INSTRUCTIONS_ENVOYEES);
    expect(res.channel).toBe(PaymentChannel.VIR);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('refuses when the reservation has no client account at all', async () => {
    await build(IdVerificationStatus.VERIFIED);
    prisma.landReservation.findUnique.mockResolvedValue({
      clientUserId: null,
      clientName: 'Walk-in',
      land: { title: 'Parcelle' },
    });

    await expect(service.sendInstructions('pay-1', SEND)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(email.send).not.toHaveBeenCalled();
  });

  // ----- THE GATE IS ON THE CORRIDOR, NOT ONE DOOR ----- //

  it('the generic transition route cannot go round it', async () => {
    /**
     * The gate lives in `transition`, through which every state change passes -
     * the send, the back-office step control, and anything written later. A
     * check in the send route alone would guard one door and leave the corridor
     * open.
     */
    await build(IdVerificationStatus.PENDING);

    await expect(
      service.transitionAsAdmin('pay-1', PaymentState.INSTRUCTIONS_ENVOYEES, {
        actorUserId: ADMIN,
        reason: 'trying the side entrance',
        roles: ['ADMIN_GLOBAL'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([PaymentState.ANNULE, PaymentState.EXPIRE, PaymentState.REJETE])(
    'does not block the exit to %s',
    async (exit) => {
      /**
       * Deliberately ungated. A request from somebody who never completed their
       * identification must still be refusable, expirable and cancellable - or
       * an unverified client's payment would be stuck for ever and the dunning
       * queue could never clear it. The gate protects the coordinates, not the
       * bin.
       */
      await build(IdVerificationStatus.NONE);

      await expect(
        service.transitionAsAdmin('pay-1', exit, {
          actorUserId: ADMIN,
          reason: 'client unreachable for 30 days',
          roles: ['ADMIN_GLOBAL'],
        }),
      ).resolves.toEqual({ state: exit });
    },
  );

  // ----- THE PREFERENCE IS SHOWN, AND IS NOT THE DECISION ----- //

  it('the back office may send a channel different from the preference', async () => {
    await build(IdVerificationStatus.VERIFIED);

    // The payment's preference is OMO; the decision is VIR.
    const res = await service.sendInstructions('pay-1', SEND);

    expect(res.channel).toBe(PaymentChannel.VIR);
    const written = prisma.payment.update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(written.data['channel']).toBe(PaymentChannel.VIR);
    // And the wish is untouched by the decision.
    expect(written.data).not.toHaveProperty('preferredChannel');
  });

  it('the audit row records who, which channel, and why', async () => {
    await build(IdVerificationStatus.VERIFIED);

    await service.sendInstructions('pay-1', SEND);

    const audit = prisma.paymentTransition.create.mock.calls[0][0] as {
      data: { actorUserId: string; channel: string; reason: string; communicatedDetails: unknown };
    };
    expect(audit.data.actorUserId).toBe(ADMIN);
    expect(audit.data.channel).toBe(PaymentChannel.VIR);
    expect(audit.data.reason).toBe(SEND.reason);
    // And what was actually communicated, so a dispute is settled by the system.
    expect(audit.data.communicatedDetails).toMatchObject({ bankIban: expect.any(String) });
  });
});
