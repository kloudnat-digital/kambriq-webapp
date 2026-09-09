/**
 * How a back-office queue reports its own backlog.
 *
 * Extracted by `G6`, when the dunning queue would have been the **third**
 * hand-written copy of the same six lines. The other two:
 *
 *   - `UsersService.listPendingIdDocuments` - the identity review queue (`A10`)
 *   - `PaymentsService.listRequestQueue`    - the payment request queue (`G11`)
 *
 * Both had already converged, independently, on the same three decisions, and
 * both had their own private `ageDays` arrow function computing the same
 * milliseconds-to-days division. Two copies is a coincidence; three is a
 * pattern that should have been shared, and the copy nobody updates is the one
 * that goes wrong.
 *
 * The three decisions, kept here so they are made once:
 *
 * 1. **Oldest first.** A queue sorted newest-first hides the row that has been
 *    waiting longest, which is the only row that matters. `A10`.
 * 2. **Every row carries its own age**, so a reviewer can see which item is the
 *    old one without subtracting dates in their head.
 * 3. **The envelope carries the age of the oldest item in the WHOLE backlog**,
 *    not of the oldest on this page. A count answers "how many"; it does not
 *    answer "how long has somebody been waiting", and that is the question a
 *    backlog exists to be accountable for.
 */

/** One day, in milliseconds. Named because `86_400_000` in three files is not. */
export const ONE_DAY_MS = 86_400_000;

/**
 * Whole days between `from` and `now`, or `null` when there is no date.
 *
 * Floored, not rounded: something submitted 47 hours ago has been waiting one
 * day, not two. Rounding up would let a queue report a backlog older than it is,
 * and a number that overstates is trusted once and then never again.
 *
 * Negative when `from` is in the future - callers that mean "overdue by" should
 * clamp at zero themselves, because a payment due tomorrow is not overdue by
 * minus one day, it is simply not overdue.
 */
export const ageInDays = (
  from: Date | null | undefined,
  now: number = Date.now(),
): number | null => (from ? Math.floor((now - from.getTime()) / ONE_DAY_MS) : null);

/**
 * Adds `oldestWaitingDays` to a paginated response's `meta`.
 *
 * Takes the oldest date in the entire backlog, which the caller must fetch
 * separately from the page - `findFirst` ordered ascending, inside the same
 * transaction as the page and the count, so the three agree with each other.
 * Passing the first row of the current page instead is correct only on page one
 * and quietly wrong everywhere else.
 */
export const withOldestWaiting = <T extends { meta: object }>(
  response: T,
  oldest: Date | null | undefined,
  now: number = Date.now(),
): T & { meta: T['meta'] & { oldestWaitingDays: number | null } } => ({
  ...response,
  /**
   * `null` on an empty backlog, never `0`.
   *
   * They are different claims: `0` says the oldest item has been waiting less
   * than a day, `null` says there is no oldest item. Extracting this helper is
   * what revealed the two existing queues disagreed - the identity queue
   * returned `null` and had a test pinning it, the payment request queue
   * returned `0` and had none. The tested one is also the honest one.
   */
  meta: { ...response.meta, oldestWaitingDays: ageInDays(oldest, now) },
});
