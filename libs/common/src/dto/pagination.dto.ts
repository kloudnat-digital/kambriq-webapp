import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { type } from 'os';

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

export const buildPaginationMeta = (
  total: number,
  page: number,
  limit: number,
): PaginationMeta => {
  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const buildPaginatedResponse = <T>(
  data: T[],
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
