import { BadRequestException } from '@nestjs/common';

/**
 * The column a paginated list is ordered by, checked against what the caller is
 * allowed to ask for.
 *
 * `paginationQuerySchema` accepts `sort` as any string, and every list service
 * spread it straight into `orderBy: { [sort]: order }`. Prisma refuses a column
 * its model does not have, so the request became a 500 - a client typo answered
 * as a server fault. Nothing is injectable there, because Prisma validates the
 * key against the model; what was wrong is the status and the silence.
 *
 * An allowlist per call site, not a shared list of every sortable column
 * anywhere: `examId` is a real column on one model and a 500 on the other eight,
 * so one list would authorise exactly the requests that still fail.
 *
 * Refuses rather than falling back to the default. A list silently ordered by
 * something other than what was asked for is the wrong answer presented as the
 * right one, and the caller cannot tell.
 */
export const sortField = <T extends string>(
  requested: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T => {
  if (!requested) return fallback;
  if ((allowed as readonly string[]).includes(requested)) return requested as T;
  throw new BadRequestException(
    `Cannot sort by '${requested}'. Allowed: ${[...allowed].sort().join(', ')}.`,
  );
};

/** Every model in the four schemas carries both, so every list can offer them. */
export const TIMESTAMP_SORTS = ['createdAt', 'updatedAt'] as const;
