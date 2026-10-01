import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LandsService } from '../../../lands/lands.service';

/** The French messages the API answers with, read from the shipped file. */
const FR = JSON.parse(
  readFileSync(join(__dirname, '../../../../../../libs/common/src/i18n/fr/lands.json'), 'utf8'),
);

const translate = (key: string, opts?: { args?: Record<string, string> }) => {
  const path = key.split('.').slice(1);
  let text: string = path.reduce((o: Record<string, unknown>, k) => o[k] as never, FR) as never;
  for (const [k, v] of Object.entries(opts?.args ?? {})) text = text.replace(`{${k}}`, v);
  return text;
};

export const base = {
  title: 'Parcelle',
  description: 'Une parcelle',
  region: 'Littoral',
  sizeM2: 492,
  totalPrice: 4_920_000,
  labelId: 'label',
} as never;

/** A LandsService over a stub database that records what it was asked to write. */
export const makeService = () => {
  const writes: unknown[] = [];
  const existing = { id: 'land', titleNumber: null, totalPrice: 4_920_000n };
  const prisma = {
    land: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string } }) =>
        where.id ? existing : null,
      ),
      create: jest.fn(async ({ data }: { data: unknown }) => (writes.push(data), data)),
      update: jest.fn(async ({ data }: { data: unknown }) => (writes.push(data), data)),
    },
    landLabel: { findUnique: jest.fn(async () => ({ id: 'label' })) },
    landPriceHistory: { create: jest.fn() },
  };
  const service = new LandsService(prisma as never, {} as never, { translate } as never);
  return { service, writes };
};
