import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { LandReservationStatus, LandStatus, StorageService } from '@kambriq/common';
import { LandsService } from '../../lands/lands.service';
import { LandsPrismaService } from '../../lands/prisma/lands-prisma.service';
import { mockI18n, mockStorageService } from '../utils';
import { openTestDatabase, type TestDatabase } from './lands-test-db';

/**
 * C32 - the land detail carries live reservations only. A cancelled
 * reservation neither holds the parcel nor shows its client's contact details
 * to the agents and administrators who read the detail.
 */
describe('C32 - the land detail carries no cancelled reservation', () => {
  let db: TestDatabase;
  let lands: LandsPrismaService;
  let service: LandsService;

  beforeAll(async () => {
    db = openTestDatabase();
    lands = new LandsPrismaService({
      get: (key: string) => (key === 'DATABASE_URL_LANDS' ? db.url : undefined),
    } as unknown as ConfigService);
    await lands.onModuleInit();
    service = new LandsService(
      lands,
      mockStorageService() as unknown as StorageService,
      mockI18n() as never,
    );
  });

  afterAll(async () => {
    await lands.onModuleDestroy();
    await db.close();
  });

  const parcel = async () => {
    const tag = randomUUID();
    const label = await db.prisma.landLabel.upsert({
      where: { code: 'TFL' },
      create: { code: 'TFL', name: 'Titre foncier' },
      update: {},
    });
    return db.prisma.land.create({
      data: {
        title: `C32 ${tag}`,
        slug: `c32-${tag}`,
        description: 'Created by the database-backed suite.',
        region: 'Ouest',
        sizeM2: 500,
        totalPrice: 15_000_000,
        status: LandStatus.AVAILABLE,
        labelId: label.id,
      },
    });
  };

  const reserve = (landId: string, status: LandReservationStatus, who: string) =>
    db.prisma.landReservation.create({
      data: {
        landId,
        status,
        agentUserId: `agent-${who}`,
        clientUserId: `client-${who}`,
        clientName: `Client ${who}`,
        clientEmail: `${who}@example.test`,
        clientPhone: `+2376${who.replace(/\D/g, '').slice(0, 8).padEnd(8, '0')}`,
        downPaymentAmount: 750_000n,
        // The whole 500 m2 parcel: the sale's surface and amount (C49).
        purchasedM2: 500,
        saleAmount: 15_000_000n,
      },
    });

  it('returns a parcel with only cancelled reservations as sellable, with no trace of them', async () => {
    const land = await parcel();
    const cancelled = [];
    for (const n of [1, 2, 3, 4, 5]) {
      cancelled.push(
        await reserve(land.id, LandReservationStatus.CANCELLED, `c32gone${n}-${randomUUID()}`),
      );
    }

    const detail = await service.findByIdFull(land.id);
    expect(detail.status).toBe(LandStatus.AVAILABLE);
    expect(detail.reservations).toEqual([]);

    const body = JSON.stringify(detail, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
    for (const r of cancelled) {
      expect(body).not.toContain(r.id);
      expect(body).not.toContain(r.clientName);
      expect(body).not.toContain(r.clientEmail);
      expect(body).not.toContain(r.clientPhone as string);
    }
  });

  it('still returns the live reservation, and only it, beside cancelled ones', async () => {
    const land = await parcel();
    const gone = await reserve(land.id, LandReservationStatus.CANCELLED, `c32old-${randomUUID()}`);
    const live = await reserve(land.id, LandReservationStatus.PENDING, `c32live-${randomUUID()}`);

    const detail = await service.findByIdFull(land.id);
    expect(detail.reservations.map((r) => r.id)).toEqual([live.id]);
    expect(
      JSON.stringify(detail, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    ).not.toContain(gone.clientEmail);
  });
});
