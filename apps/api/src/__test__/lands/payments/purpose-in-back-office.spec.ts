import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService, PaymentState, StorageService } from '@kambriq/common';
import { PaymentPurpose } from '@kambriq/common/payments/payment-purpose';
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

const balance = {
  id: 'pay-2',
  reference: 'KBQ-2609-SOLDE-1',
  reservationId: 'res-1',
  purpose: PaymentPurpose.SOLDE,
  currency: 'XAF',
  amountDue: 3_230_000n,
  state: PaymentState.INITIE,
  expiresAt: null,
  createdAt: new Date('2026-09-20T00:00:00Z'),
  receipts: [],
  transitions: [],
};

/**
 * G20 gave a payment its purpose; the back office is where a person decides on
 * one, and until this change it could not tell a deposit from a balance. Every
 * back-office read carries the purpose (the overdue queue's is in dunning.spec).
 */
describe('G20 - the back office sees which payment it decides on', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;

  beforeEach(async () => {
    prisma = mockLandsPrisma();
    const core = mockCorePrisma();
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });
    core.userProfile.findMany.mockResolvedValue([]);
    prisma.landReservation.findUnique.mockResolvedValue({ clientUserId: 'user-1' });
    prisma.landReservation.findMany.mockResolvedValue([]);
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

  it('the payment list', async () => {
    prisma.$transaction.mockResolvedValue([[balance], 1]);
    const res = await service.listForBackOffice({
      page: 1,
      limit: 20,
      sort: 'createdAt',
      order: 'desc',
    });
    expect(res.data[0].purpose).toBe(PaymentPurpose.SOLDE);
  });

  it('the payment detail', async () => {
    prisma.payment.findUnique.mockResolvedValue(balance);
    const res = await service.findForBackOffice('pay-2');
    expect(res.purpose).toBe(PaymentPurpose.SOLDE);
  });

  it('the request queue', async () => {
    prisma.$transaction.mockResolvedValue([[balance], 1]);
    const res = await service.listRequests({ page: 1, limit: 20, sort: 'createdAt', order: 'asc' });
    expect(res.data[0].purpose).toBe(PaymentPurpose.SOLDE);
  });
});
