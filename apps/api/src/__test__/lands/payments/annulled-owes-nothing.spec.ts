import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService, PaymentState, StorageService } from '@kambriq/common';
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

const annulled = {
  id: 'pay-9',
  reference: 'KBQ-2609-ANNUL-1',
  reservationId: 'res-9',
  purpose: 'ACOMPTE',
  currency: 'XAF',
  amountDue: 380_000n,
  state: PaymentState.ANNULE,
  expiresAt: null,
  createdAt: new Date('2026-09-20T00:00:00Z'),
  receipts: [{ amount: 100_000n }],
  transitions: [],
};

/**
 * G22 - the back office reads what an annulled payment still asks for: nothing.
 * Its receipts stay on its ledger, as received.
 */
describe('G22 - an annulled payment owes nothing on the back office', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;

  beforeEach(async () => {
    prisma = mockLandsPrisma();
    const core = mockCorePrisma();
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });
    prisma.landReservation.findUnique.mockResolvedValue({ clientUserId: 'user-1' });
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

  it('the list', async () => {
    prisma.$transaction.mockResolvedValue([[annulled], 1]);
    const res = await service.listForBackOffice({
      page: 1,
      limit: 20,
      sort: 'createdAt',
      order: 'desc',
    });
    expect(res.data[0]).toMatchObject({ amountReceived: '100000', outstanding: '0' });
  });

  it('the detail', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      ...annulled,
      receipts: [
        {
          id: 'r1',
          amount: 100_000n,
          currency: 'XAF',
          channel: 'VIR',
          receivedAt: new Date(),
          recordedAt: new Date(),
          recordedBy: 'a',
          evidenceUrl: 'k',
          paidBy: null,
          correctsId: null,
          note: null,
        },
      ],
    });
    const res = await service.findForBackOffice('pay-9');
    expect(res).toMatchObject({ amountReceived: '100000', outstanding: '0' });
  });
});
