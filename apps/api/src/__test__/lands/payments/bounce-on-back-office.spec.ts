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

const payment = {
  id: 'pay-1',
  reference: 'KBQ-2609-BOUNC-1',
  reservationId: 'res-1',
  purpose: 'ACOMPTE',
  currency: 'XAF',
  amountDue: 380_000n,
  state: PaymentState.INITIE,
  expiresAt: null,
  createdAt: new Date('2026-09-28T00:00:00Z'),
  receipts: [],
  transitions: [],
};

/**
 * C26 - the back office reads, with the payment, what SES reported about the
 * client's current address, so the operator sees it where instructions are sent.
 */
describe('C26 - a bounced client address travels with the payment to the back office', () => {
  let service: PaymentsService;
  let core: ReturnType<typeof mockCorePrisma>;

  beforeEach(async () => {
    const prisma = mockLandsPrisma();
    core = mockCorePrisma();
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });
    core.user.findUnique.mockResolvedValue({ email: 'Ada@Example.com' });
    prisma.landReservation.findUnique.mockResolvedValue({ clientUserId: 'user-1' });
    prisma.payment.findUnique.mockResolvedValue(payment);
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

  it('carries the latest event for the address the client uses now', async () => {
    core.emailDeliveryEvent.findFirst.mockResolvedValue({
      kind: 'BOUNCE',
      type: 'Permanent',
      subType: 'General',
      occurredAt: new Date('2026-09-28T08:25:45.760Z'),
    });

    const detail = await service.findForBackOffice('pay-1');

    expect(core.emailDeliveryEvent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', email: { equals: 'Ada@Example.com', mode: 'insensitive' } },
        orderBy: { occurredAt: 'desc' },
      }),
    );
    expect(detail.clientEmailDelivery).toEqual({
      kind: 'BOUNCE',
      type: 'Permanent',
      subType: 'General',
      occurredAt: '2026-09-28T08:25:45.760Z',
    });
  });

  it('says null when SES reported nothing', async () => {
    core.emailDeliveryEvent.findFirst.mockResolvedValue(null);
    expect((await service.findForBackOffice('pay-1')).clientEmailDelivery).toBeNull();
  });
});
