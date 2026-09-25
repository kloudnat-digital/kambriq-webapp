/**
 * Resolves the restored status for a seeded parcel.
 *
 * Prevents inconsistencies when the seed script encounters reservations tied
 * to payments, which cannot be deleted due to ledger constraints. Parcel status
 * projects these uncleared reservations (e.g., RESERVED, SOLD) instead of reverting.
 *
 * Uses plain string unions over Prisma enums to support testing without a generated client.
 */
export type SeedLandStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'ARCHIVED';
export type SeedReservationStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

/** The parcel status the API maintains while this reservation stands, or null if it holds nothing. */
export const statusHeldBy = (reservation: SeedReservationStatus): SeedLandStatus | null => {
  if (reservation === 'CANCELLED') return null;
  if (reservation === 'COMPLETED') return 'SOLD';
  return 'RESERVED';
};

/**
 * The status the seed may write for a parcel, given the reservations on it that
 * the seed could not clear. The seeded status only when none of them holds it.
 */
export const restoredParcelStatus = (
  seeded: SeedLandStatus,
  keptReservations: readonly SeedReservationStatus[],
): SeedLandStatus => {
  const held = keptReservations.map(statusHeldBy);
  if (held.includes('SOLD')) return 'SOLD';
  if (held.includes('RESERVED')) return 'RESERVED';
  return seeded;
};
