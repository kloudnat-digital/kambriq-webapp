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
 * Constraint type that prevents `T` from being a Promise.
 * Ensures paginated endpoints do not accidentally return unawaited Promises,
 * which serialize to empty objects in JSON responses.
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
