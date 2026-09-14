/**
 * A31 - the status a seeded parcel may be restored to.
 *
 * The seed is restorative: it puts a parcel back to its seeded status and
 * deletes the reservations journeys made on it. But it cannot delete a
 * reservation that carries a payment - G1's foreign key and the ledger's
 * append-only triggers refuse, rightly - and it keeps those rows.
 *
 * It then reset the parcel's status anyway. On dev on 14 September that left
 * eight parcels listed AVAILABLE while each carried a PENDING reservation: the
 * listing said "free", the reservation service said "already reserved", and
 * every journey that took the first available parcel got a 409. The seed's own
 * log said "Those parcels keep their current status", which the code did not do.
 *
 * So a parcel still held by a reservation the seed kept is given the status the
 * API itself gives a parcel under that reservation, never its seeded one. The
 * mapping is the API's, not a new rule: creating a reservation sets RESERVED,
 * completing one sets SOLD, cancelling one frees the parcel
 * (`lands/reservations/reservations.service.ts`).
 *
 * Plain string unions rather than the generated Prisma enums, so this can be
 * tested without a generated client. The values are the same strings.
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
