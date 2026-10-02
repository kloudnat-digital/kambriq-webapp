import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { portionPrice } from '@kambriq/common';
import { LandsPrismaService } from '../../lands/prisma/lands-prisma.service';
import { LandsService } from '../../lands/lands.service';
import { mockI18n, mockStorageService } from '../utils';
import { openTestDatabase, type TestDatabase } from './lands-test-db';

/**
 * C49 - a past rate per m2 reads back exactly from the price history.
 *
 * The history recorded totals and not the surface, so after a surface change
 * the rate of a past period was no longer computable. Each row now carries the
 * surface in force from that change on; the period's price for any surface is
 * the total pro rata of it, exact - never the rounded generated rate times the
 * surface. Against the real lands migrations, through the service.
 */
describe('C49 - the price history reconstructs a past rate exactly', () => {
  let db: TestDatabase;
  let lands: LandsPrismaService;
  let service: LandsService;
  const ADMIN = '00000000-0000-4000-8000-b00000000001';

  beforeAll(async () => {
    db = openTestDatabase();
    lands = new LandsPrismaService({
      get: (key: string) => (key === 'DATABASE_URL_LANDS' ? db.url : undefined),
    } as unknown as ConfigService);
    await lands.onModuleInit();
    service = new LandsService(lands, mockStorageService() as never, mockI18n() as never);
  });

  afterAll(async () => {
    await lands.onModuleDestroy();
    await db.close();
  });

  it('records the surface with each change, and gives back each period exactly', async () => {
    const label = await db.prisma.landLabel.upsert({
      where: { code: 'TFL' },
      create: { code: 'TFL', name: 'Titre foncier' },
      update: {},
    });
    const tag = randomUUID();
    const land = await db.prisma.land.create({
      data: {
        title: `C49 history ${tag}`,
        slug: `c49-history-${tag}`,
        description: 'Created by the database-backed suite.',
        region: 'Littoral',
        sizeM2: 300,
        totalPrice: 9_000_000n,
        labelId: label.id,
      },
    });

    // Repriced: 9 800 000 over 300 m2 - a rate of 32 666.67 that rounds.
    await service.update(land.id, { totalPrice: 9_800_000 } as never, ADMIN);
    // Re-surveyed: 320 m2, total unchanged - the rate moves without the price.
    await service.update(land.id, { sizeM2: 320 } as never, ADMIN);

    const rows = await db.prisma.landPriceHistory.findMany({
      where: { landId: land.id },
      orderBy: { changedAt: 'asc' },
    });
    expect(rows.map((r) => [r.newTotalPrice, r.sizeM2])).toEqual([
      [9_800_000n, 300],
      [9_800_000n, 320],
    ]);

    // The first period, read back: 300 m2 cost exactly 9 800 000 ...
    expect(portionPrice(rows[0].newTotalPrice, 300, rows[0].sizeM2)).toBe(9_800_000n);
    // ... where the rounded rate times the surface would say 9 800 100.
    expect(BigInt(Math.round(9_800_000 / 300)) * 300n).toBe(9_800_100n);
    // The second period: the same total over 320 m2, 30 625 per m2 exactly.
    expect(portionPrice(rows[1].newTotalPrice, 1, rows[1].sizeM2)).toBe(30_625n);
  });
});
