import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { EmailService, PaymentPurpose, PaymentState, StorageService } from '@kambriq/common';
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
const RESERVATION = 'res-g20';

/** The diagnosis parcel: 3 400 000 total, a 170 000 deposit due. */
const reservation = (over: Record<string, unknown> = {}) => ({
  id: RESERVATION,
  clientUserId: CLIENT,
  clientName: 'Awono Test Client',
  status: 'CONFIRMED',
  downPaymentAmount: 170000,
  documentsReceivedAt: new Date('2026-09-20T10:00:00Z'),
  land: { title: 'Parcelle Bertoua Nkolbikon', totalPrice: 3_400_000 },
  payments: [],
  ...over,
});

const deposit = (state: PaymentState, id = 'pay-acompte') => ({
  id,
  reference: 'KBQ-2609-ACOMP-X',
  state,
  purpose: PaymentPurpose.ACOMPTE,
});

/**
 * G20 - the balance is a payment on the ledger, and it is what is still owed:
 * the total minus what was RECEIVED on the deposit (Visquis, 26 September), not
 * minus the deposit that was due. A deposit that arrived short leaves its
 * shortfall in the balance instead of a hole nobody sees.
 */
describe('G20 - the balance on the ledger', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = mockLandsPrisma();
    const core = mockCorePrisma();
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });
    prisma.$queryRaw.mockResolvedValue([{ nextval: 1n }]);
    prisma.payment.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'pay-new', ...data }),
    );
    prisma.paymentTransition.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((fn: unknown) =>
      Promise.resolve((fn as (tx: unknown) => unknown)(prisma)),
    );
    prisma.payment.findUnique.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        id: where.id,
        reference: 'KBQ-X',
        amountDue: 1n,
        currency: 'XAF',
        state: 'INITIE',
      }),
    );
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

  const created = () =>
    prisma.payment.create.mock.calls.map(
      ([arg]) => (arg as { data: Record<string, unknown> }).data,
    );

  it('with no payment yet, the request creates the deposit, marked as the deposit', async () => {
    prisma.landReservation.findUnique.mockResolvedValue(
      reservation({ status: 'PENDING', documentsReceivedAt: null }),
    );
    await service.requestPaymentForReservation(CLIENT, RESERVATION);
    expect(created()).toEqual([
      expect.objectContaining({ purpose: PaymentPurpose.ACOMPTE, amountDue: 170000n }),
    ]);
  });

  it('once the deposit is settled and the documents received, the request creates the balance', async () => {
    prisma.landReservation.findUnique.mockResolvedValue(
      reservation({ payments: [deposit(PaymentState.VALIDE)] }),
    );
    prisma.paymentReceipt.findMany.mockResolvedValue([{ amount: 170000n }]);
    await service.requestPaymentForReservation(CLIENT, RESERVATION);
    expect(created()).toEqual([
      expect.objectContaining({ purpose: PaymentPurpose.SOLDE, amountDue: 3_230_000n }),
    ]);
  });

  it('a deposit that arrived short leaves its shortfall in the balance: 160 000 received, 3 240 000 owed', async () => {
    prisma.landReservation.findUnique.mockResolvedValue(
      reservation({ payments: [deposit(PaymentState.VALIDE)] }),
    );
    prisma.paymentReceipt.findMany.mockResolvedValue([{ amount: 100000n }, { amount: 60000n }]);
    await service.requestPaymentForReservation(CLIENT, RESERVATION);
    expect(created()[0]).toMatchObject({ amountDue: 3_240_000n });
  });

  it('what was received is read from the deposit payment, not from anything else', async () => {
    prisma.landReservation.findUnique.mockResolvedValue(
      reservation({ payments: [deposit(PaymentState.VALIDE)] }),
    );
    prisma.paymentReceipt.findMany.mockResolvedValue([{ amount: 170000n }]);
    await service.requestPaymentForReservation(CLIENT, RESERVATION);
    expect(prisma.paymentReceipt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { paymentId: { in: ['pay-acompte'] } } }),
    );
  });

  it('before the documents are received, the balance is not due and nothing is created', async () => {
    prisma.landReservation.findUnique.mockResolvedValue(
      reservation({ payments: [deposit(PaymentState.VALIDE)], documentsReceivedAt: null }),
    );
    await expect(service.requestPaymentForReservation(CLIENT, RESERVATION)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });

  it('a live balance is returned, never a second one', async () => {
    prisma.landReservation.findUnique.mockResolvedValue(
      reservation({
        payments: [
          deposit(PaymentState.VALIDE),
          {
            id: 'pay-solde',
            reference: 'KBQ-S',
            state: PaymentState.INITIE,
            purpose: PaymentPurpose.SOLDE,
          },
        ],
      }),
    );
    const result = await service.requestPaymentForReservation(CLIENT, RESERVATION);
    expect(result.id).toBe('pay-solde');
    expect(prisma.payment.create).not.toHaveBeenCalled();
  });
});
