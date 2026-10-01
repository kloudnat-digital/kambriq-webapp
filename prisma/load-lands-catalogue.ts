/**
 * C16 - creates the fourteen real parcels of the LANDS catalogue v07.5, unpublished.
 *
 * Execution:
 *   pnpm tsx --tsconfig tsconfig.base.json prisma/load-lands-catalogue.ts
 *
 * The rows come from `seed-data/lands-catalogue-v075.ts`. The script is
 * create-only: a parcel already present is never written, its differences
 * from the catalogue are printed instead, and the run exits non-zero so a
 * drift is seen rather than overwritten. It never publishes anything and never
 * touches a parcel the catalogue does not name. The five surface-less sites
 * and fiche 018 are not loaded.
 *
 * Postcondition: the fourteen ids read back, unpublished, with the
 * database-generated price per m2 equal to the catalogue's.
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient as LandsClient } from '../libs/common/src/prisma/lands-client/client';
import { CATALOGUE_PARCELS, type CatalogueLabel } from './seed-data/lands-catalogue-v075';
import { catalogueDrift, catalogueLandRows } from './seed-data/lands-catalogue-load';

const main = async () => {
  const url = process.env['DATABASE_URL_LANDS'];
  if (!url) throw new Error('DATABASE_URL_LANDS is not set, so there is no database to load into');

  console.log('Kambriq lands catalogue load starting');
  const pool = new Pool({ connectionString: url });
  const lands = new LandsClient({ adapter: new PrismaPg(pool) });

  try {
    const target = new URL(url);
    console.log(`  database ${target.host}${target.pathname}`);

    const labels = await lands.landLabel.findMany({ select: { id: true, code: true } });
    const labelIds = Object.fromEntries(labels.map((l) => [l.code, l.id])) as Record<
      CatalogueLabel,
      string
    >;
    const rows = catalogueLandRows(CATALOGUE_PARCELS, labelIds);

    let created = 0;
    let present = 0;
    const drifted: string[] = [];
    for (const row of rows) {
      const found = await lands.land.findUnique({ where: { id: row.id } });
      if (found) {
        present += 1;
        const fields = catalogueDrift(row, found);
        if (fields.length > 0) drifted.push(`${row.verificationRef}: ${fields.join(', ')}`);
        continue;
      }
      await lands.land.create({ data: row });
      created += 1;
      console.log(`  [${row.verificationRef}] created`);
    }

    const back = await lands.land.findMany({
      where: { id: { in: rows.map((r) => r.id) } },
      select: { id: true, isPublished: true, pricePerM2: true },
    });
    const byId = new Map(back.map((b) => [b.id, b]));
    const wrong = CATALOGUE_PARCELS.filter((p) => {
      const b = byId.get(p.id);
      return !b || b.isPublished || b.pricePerM2 !== p.pricePerM2;
    });
    if (wrong.length > 0) {
      throw new Error(`postcondition failed for ${wrong.map((p) => p.ref).join(', ')}`);
    }
    console.log(`  postcondition verified for ${back.length} parcel(s), all unpublished`);

    if (drifted.length > 0) {
      for (const line of drifted) console.log(`  DRIFT ${line}`);
      throw new Error(
        `${drifted.length} parcel(s) differ from the catalogue; nothing was overwritten`,
      );
    }
    console.log(
      `Kambriq lands catalogue load complete: ${created} created, ${present} already present`,
    );
  } finally {
    await lands.$disconnect();
    await pool.end();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
