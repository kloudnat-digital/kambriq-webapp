import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException } from '@nestjs/common';
import { EmailService, validateReference, StorageService } from '@kambriq/common';
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

/**
 * G2 - creation assigns the reference, and the counter cannot collide.
 */
describe('createPayment', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof mockLandsPrisma>;
  let core: ReturnType<typeof mockCorePrisma>;
  let counter: number;

  beforeEach(async () => {
    jest.clearAllMocks();
    counter = 0;
    prisma = mockLandsPrisma();
    core = mockCorePrisma();
    // Verified by default: these suites are about the payment machinery, not
    // about the gate, and an unverified fixture would make every one of them
    // fail for a reason none of them is testing. `payment-identification-gate.spec.ts`
    // is where the gate itself is exercised.
    core.userProfile.findUnique.mockResolvedValue({ idVerificationStatus: 'verified' });

    // Stands in for `nextval`: hands out each value exactly once, whatever the
    // interleaving. That is the property the real sequence provides.
    prisma.$queryRaw.mockImplementation(() => Promise.resolve([{ nextval: BigInt(++counter) }]));
    prisma.payment.create.mockImplementation((args: unknown) =>
      Promise.resolve({ id: `p${counter}`, ...(args as { data: object }).data }),
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

  // G9: creation is a named act, so these two are not optional.
  const input = {
    reservationId: 'res-1',
    amountDue: 750_000n,
    currency: 'XAF',
    createdBy: '00000000-0000-4000-8000-c00000000001',
    reason: 'Acompte requested by the client.',
  };

  it('assigns a valid reference at creation', async () => {
    const { reference } = await service.createPayment(input);

    expect(validateReference(reference).valid).toBe(true);
    expect(reference).toMatch(/^KBQ-\d{4}-.{5}-.$/);
  });

  it('never creates a payment without one', async () => {
    await service.createPayment(input);

    const data = prisma.payment.create.mock.calls[0][0] as { data: { reference?: string } };
    expect(data.data.reference).toBeDefined();
    expect(data.data.reference).not.toBeNull();
  });

  /**
   * (d) Concurrency.
   *
   * **What makes this meaningful rather than accidentally serial.** Awaiting
   * inside a loop would run these one after another and prove nothing about
   * concurrency - the shape this repository has a catalogue entry about. Every
   * call is started before any is awaited, so all 500 are in flight together and
   * interleave at each `await`; the counter mock deliberately holds no lock, so
   * a generator that read-then-incremented would hand out duplicates here.
   */
  it('generates no duplicates when 500 creations run in parallel', async () => {
    const results = await Promise.all(
      Array.from({ length: 500 }, () => service.createPayment(input)),
    );

    const references = results.map((r) => r.reference);
    expect(references).toHaveLength(500);
    expect(new Set(references).size).toBe(500);
    for (const r of references) expect(validateReference(r).valid).toBe(true);
  });

  it('is collision-free because the counter is, not because 29^5 is large', async () => {
    // Two creations at the same instant with the same period differ only by the
    // counter. If generation were random, this test would pass by luck.
    const a = await service.createPayment(input);
    const b = await service.createPayment(input);
    expect(a.reference).not.toBe(b.reference);
  });

  describe('when the unique index fires anyway', () => {
    const p2002 = Object.assign(new Error('Unique constraint failed'), {
      code: 'P2002',
      meta: { target: ['reference'] },
    });

    it('retries with a fresh counter value and still returns a payment', async () => {
      prisma.payment.create
        .mockRejectedValueOnce(p2002)
        .mockRejectedValueOnce(p2002)
        .mockImplementation((args: unknown) =>
          Promise.resolve({ id: 'p-final', ...(args as { data: object }).data }),
        );

      const { id, reference } = await service.createPayment(input);

      // The payment is not lost: three attempts, three distinct references, one
      // payment at the end.
      expect(id).toBe('p-final');
      expect(validateReference(reference).valid).toBe(true);
      expect(prisma.payment.create).toHaveBeenCalledTimes(3);

      const attempted = prisma.payment.create.mock.calls.map(
        (c) => (c[0] as { data: { reference: string } }).data.reference,
      );
      expect(new Set(attempted).size).toBe(3);
    });

    it('gives up loudly rather than creating a payment without a reference', async () => {
      prisma.payment.create.mockRejectedValue(p2002);

      await expect(service.createPayment(input)).rejects.toThrow(ConflictException);
      // Five attempts, and nothing created. A half-made payment would be worse
      // than none: somebody could be asked to pay against nothing.
      expect(prisma.payment.create).toHaveBeenCalledTimes(5);
    });

    it('does not swallow a different database error as a collision', async () => {
      const other = Object.assign(new Error('deadlock'), { code: 'P2034' });
      prisma.payment.create.mockRejectedValue(other);

      await expect(service.createPayment(input)).rejects.toThrow('deadlock');
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    });

    it('does not treat a unique violation on another column as a reference collision', async () => {
      const elsewhere = Object.assign(new Error('Unique constraint failed'), {
        code: 'P2002',
        meta: { target: ['reservationId'] },
      });
      prisma.payment.create.mockRejectedValue(elsewhere);

      await expect(service.createPayment(input)).rejects.toThrow('Unique constraint failed');
      expect(prisma.payment.create).toHaveBeenCalledTimes(1);
    });
  });
});
