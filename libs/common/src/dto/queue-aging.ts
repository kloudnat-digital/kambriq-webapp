/**
 * Utility functions for computing queue backlog aging.
 *
 * Design principles:
 * 1. Oldest first: Queues should be sorted ascending by date to surface the longest-waiting items.
 * 2. Row-level age: Each item includes its computed age.
 * 3. Global backlog age: The pagination envelope reports the age of the oldest item in the entire queue, not just the current page.
 */

/** One day in milliseconds. */
export const ONE_DAY_MS = 86_400_000;

/**
 * Computes the number of whole days between `from` and `now`.
 * Returns null if `from` is not provided.
 *
 * Note: The value is floored, not rounded. Returns negative values for future dates;
 * callers should clamp to zero if computing overdue periods.
 */
export const ageInDays = (
  from: Date | null | undefined,
  now: number = Date.now(),
): number | null => (from ? Math.floor((now - from.getTime()) / ONE_DAY_MS) : null);

/**
 * Appends `oldestWaitingDays` to the metadata of a paginated response.
 *
 * @param response - The paginated response object.
 * @param oldest - The oldest date in the entire backlog (should be queried independently of the current page).
 * @param now - The current timestamp.
 */
export const withOldestWaiting = <T extends { meta: object }>(
  response: T,
  oldest: Date | null | undefined,
  now: number = Date.now(),
): T & { meta: T['meta'] & { oldestWaitingDays: number | null } } => ({
  ...response,
  /**
   * Represents the age of the oldest item.
   * Null indicates an empty backlog, whereas 0 indicates the item is less than a day old.
   */
  meta: { ...response.meta, oldestWaitingDays: ageInDays(oldest, now) },
});
