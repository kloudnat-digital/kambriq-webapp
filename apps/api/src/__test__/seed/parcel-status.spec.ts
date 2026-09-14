/* eslint-disable @nx/enforce-module-boundaries -- the seed lives in prisma/, outside any nx project; these tests exist to pin it */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { restoredParcelStatus, statusHeldBy } from '../../../../../prisma/seed-data/parcel-status';

/**
 * A31 - a parcel held by a reservation the seed could not delete stays held.
 *
 * On 14 September the seed kept 37 payment-carrying reservations, reset their
 * eight parcels to AVAILABLE anyway, and journeys 4 and 5 met a 409 on every
 * push to develop from 08:22 UTC: the listing said free, the reservation
 * service said taken.
 */
describe('A31 - restoredParcelStatus', () => {
  it('keeps a parcel RESERVED while a kept reservation is PENDING - the dev case', () => {
    expect(restoredParcelStatus('AVAILABLE', ['PENDING'])).toBe('RESERVED');
  });

  it('keeps it RESERVED for a CONFIRMED reservation too', () => {
    expect(restoredParcelStatus('AVAILABLE', ['CONFIRMED'])).toBe('RESERVED');
  });

  it('keeps it SOLD for a COMPLETED reservation, which is what completion sets', () => {
    expect(restoredParcelStatus('AVAILABLE', ['COMPLETED'])).toBe('SOLD');
    expect(restoredParcelStatus('AVAILABLE', ['PENDING', 'COMPLETED'])).toBe('SOLD');
  });

  it('restores the seeded status when every kept reservation is cancelled', () => {
    // Most of the 37 were CANCELLED journey runs: they hold nothing, and the
    // parcel is genuinely free again.
    expect(restoredParcelStatus('AVAILABLE', ['CANCELLED', 'CANCELLED'])).toBe('AVAILABLE');
  });

  it('restores the seeded status when nothing was kept', () => {
    expect(restoredParcelStatus('AVAILABLE', [])).toBe('AVAILABLE');
    expect(restoredParcelStatus('SOLD', [])).toBe('SOLD');
  });

  it('never answers AVAILABLE while any kept reservation holds the parcel', () => {
    const holding = ['PENDING', 'CONFIRMED', 'COMPLETED'] as const;
    for (const r of holding) {
      expect(restoredParcelStatus('AVAILABLE', ['CANCELLED', r])).not.toBe('AVAILABLE');
    }
  });

  it('maps reservations exactly as the reservation service moves parcels', () => {
    expect(statusHeldBy('PENDING')).toBe('RESERVED');
    expect(statusHeldBy('CONFIRMED')).toBe('RESERVED');
    expect(statusHeldBy('COMPLETED')).toBe('SOLD');
    expect(statusHeldBy('CANCELLED')).toBeNull();
  });
});

describe('A31 - the seed uses it, and checks the property rather than a count', () => {
  const SEED = readFileSync(
    join(__dirname, '..', '..', '..', '..', '..', 'prisma', 'seed.ts'),
    'utf8',
  );

  it('writes each parcel status through restoredParcelStatus', () => {
    // The unit above is worthless if the upsert goes back to `parcel.status`.
    expect(SEED).toContain("from './seed-data/parcel-status'");
    expect(SEED).toMatch(/status:\s*restoredParcelStatus\(/);
    expect(SEED).not.toMatch(/update:\s*\{\s*status:\s*parcel\.status/);
  });

  it('refuses to finish while a seeded parcel is AVAILABLE under an active reservation', () => {
    // The old postcondition counted 18 AVAILABLE parcels and passed over the
    // eight that were not reservable. The property is the thing checked now.
    expect(SEED).toContain('AVAILABLE while a reservation holds them');
  });
});
