/**
 * Backlog aging computations for queue management.
 * Enforces date-ascending sorting, row-level age resolution, and global queue age reporting within pagination envelopes.
 */

/** One day in milliseconds. */
export const ONE_DAY_MS = 86_400_000;

/**
 * Computes floored days elapsed since `from`.
 * Yields negative values for future dates; callers must clamp if computing overdue periods.
 */
export const ageInDays = (
  from: Date | null | undefined,
  now: number = Date.now(),
): number | null => (from ? Math.floor((now - from.getTime()) / ONE_DAY_MS) : null);

/** Attaches `oldestWaitingDays` to paginated response metadata, reflecting the oldest item across the entire backlog. */
export const withOldestWaiting = <T extends { meta: object }>(
  response: T,
  oldest: Date | null | undefined,
  now: number = Date.now(),
): T & { meta: T['meta'] & { oldestWaitingDays: number | null } } => ({
  ...response,
  /** Backlog age in days. Null indicates an empty backlog; 0 indicates <24h. */
  meta: { ...response.meta, oldestWaitingDays: ageInDays(oldest, now) },
});
