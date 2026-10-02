import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { LandStatus } from '@kambriq/common';
import { LandsPrismaService } from '../../lands/prisma/lands-prisma.service';
import { LandReservationsService } from '../../lands/reservations/reservations.service';
import type { UsersService } from '../../core/users/users.service';
import type { PaymentsService } from '../../lands/payments/payments.service';
import { mockEmailService, mockQueue, mockStorageService } from '../utils';
import { openTestDatabase, type TestDatabase } from './lands-test-db';

/**
 * C49 - the portions of a parcel never exceed its surface, under concurrency.
 *
 * The rule is a sum across rows, so no index holds it: the reservation locks
 * the parcel row and counts its portions after the lock. Two agents reserving
 * at the same moment are served in turn, and the second sees the first.
 * Against the real lands migrations.
 */
describe('C49 - two portions that do not fit together', () => {
  let db: TestDatabase;
  let lands: LandsPrismaService;
  let reservations: LandReservationsService;

  // The refusal's text is the API's French message with its argument filled in.
  const i18n = {
    translate: (key: string, opts?: { args?: Record<string, string> }) =>
      `${key}:${opts?.args?.['remaining'] ?? ''}`,
  };

  beforeAll(async () => {
    db = openTestDatabase();
    lands = new LandsPrismaService({
      get: (key: string) => (key === 'DATABASE_URL_LANDS' ? db.url : undefined),
    } as unknown as ConfigService);
    await lands.onModuleInit();
    const users = {
      findOrCreateClientUser: async () => ({ id: `client-${randomUUID()}`, isNew: true }),
      findById: async () => ({ email: 'agent@example.test', firstName: 'Agent', profile: null }),
    } as unknown as UsersService;
    reservations = new LandReservationsService(
      lands,
      users,
      mockEmailService() as never,
      mockStorageService() as never,
      i18n as never,
      mockQueue() as never,
      {} as PaymentsService,
    );
  });

  afterAll(async () => {
    await lands.onModuleDestroy();
    await db.close();
  });

  const parcel = async (sizeM2: number, totalPrice: bigint) => {
    const label = await db.prisma.landLabel.upsert({
      where: { code: 'TFL' },
      create: { code: 'TFL', name: 'Titre foncier' },
      update: {},
    });
    const tag = randomUUID();
    return db.prisma.land.create({
      data: {
        title: `C49 ${tag}`,
        slug: `c49-${tag}`,
        description: 'Created by the database-backed suite.',
        region: 'Littoral',
        sizeM2,
        totalPrice,
        labelId: label.id,
        isPublished: true,
      },
    });
  };

  const reserve = (landId: string, purchasedM2: number, who: string) =>
    reservations.create(`agent-${who}`, {
      landId,
      purchasedM2,
      clientName: `Client ${who}`,
      clientEmail: `${who}-${randomUUID()}@example.test`,
      clientPhone: '+237699000049',
    } as never);

  it('accepts one and refuses the other, quoting the surface left', async () => {
    const land = await parcel(1_000, 10_000_000n);

    const [a, b] = await Promise.allSettled([
      reserve(land.id, 600, 'a'),
      reserve(land.id, 600, 'b'),
    ]);

    const outcomes = [a, b].map((r) => r.status);
    expect(outcomes.sort()).toEqual(['fulfilled', 'rejected']);
    const refused = [a, b].find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(refused.reason).toBeInstanceOf(ConflictException);
    expect((refused.reason as Error).message).toBe('lands.reservation.surfaceExceeded:400');

    const held = await db.prisma.landReservation.findMany({ where: { landId: land.id } });
    expect(held.map((r) => r.purchasedM2)).toEqual([600]);
    expect(held[0].saleAmount).toBe(6_000_000n);
    expect(held[0].downPaymentAmount).toBe(300_000n);

    // 400 m2 left: the parcel stays listed for agents.
    const after = await db.prisma.land.findUniqueOrThrow({ where: { id: land.id } });
    expect(after.status).toBe(LandStatus.AVAILABLE);
  });

  it('sells the rest, then marks the parcel RESERVED once no surface is left', async () => {
    const land = await parcel(1_000, 10_000_000n);
    await reserve(land.id, 600, 'c');
    await reserve(land.id, 400, 'd');
    const after = await db.prisma.land.findUniqueOrThrow({ where: { id: land.id } });
    expect(after.status).toBe(LandStatus.RESERVED);
    await expect(reserve(land.id, 1, 'e')).rejects.toBeInstanceOf(ConflictException);
  });

  it('prices 400 m2 of fiche 006 (2 750 m2, 22 000 000) at 3 200 000, deposit 160 000', async () => {
    const land = await parcel(2_750, 22_000_000n);
    const r = await reserve(land.id, 400, 'f');
    expect(r.saleAmount).toBe(3_200_000n);
    expect(r.downPaymentAmount).toBe(160_000n);
  });
});
