import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

// ----- Pagination Query - Reusable accross all list endpoints -----
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// ----- Pagination Meta - Returned in list responses -----
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const buildPaginationMeta = (total: number, page: number, limit: number): PaginationMeta => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

/**
 * `T` may not be a Promise.
 *
 * `buildPaginatedResponse<T>(data: T[])` accepted anything, so a list of
 * unawaited Promises bound `T = Promise<UserResponse>` and compiled cleanly.
 * `GET /users` then served `{"success":true,"data":[{},{},{}],"meta":{"total":14}}`
 * — 200, correct envelope, correct pagination, no data, because
 * `JSON.stringify` renders a Promise as `{}`.
 *
 * The type system had every opportunity and inferred its way past it: an
 * unconstrained generic will happily be a Promise. This constraint closes that
 * at **every paginated endpoint at once**, which is where lists live and where
 * this class of defect surfaces, and it fails in `tsc` rather than in a test —
 * so it is caught before the code runs at all.
 *
 * It is the same shape of fix as banning bare role-code literals: make the
 * wrong thing unwriteable rather than correcting one instance of it.
 */
type NotPromise<T> = T extends Promise<unknown> ? never : T;

export const buildPaginatedResponse = <T>(
  data: NotPromise<T>[],
  total: number,
  page: number,
  limit: number,
) => {
  return {
    success: true,
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
};
