import { buildPaginatedResponse, buildPaginationMeta } from '../../dto/pagination.dto';

describe('Pagination utilities', () => {
  describe('buildPaginationMeta', () => {
    it('calculates totalPages correctly', () => {
      const meta = buildPaginationMeta(55, 1, 20);
      expect(meta).toEqual({
        total: 55,
        page: 1,
        limit: 20,
        totalPages: 3,
      });
    });

    it('returns 1 page when total <= limit', () => {
      const meta = buildPaginationMeta(5, 1, 20);
      expect(meta.totalPages).toBe(1);
    });

    it('returns 0 pages when total is 0', () => {
      const meta = buildPaginationMeta(0, 1, 20);
      expect(meta.totalPages).toBe(0);
    });
  });

  describe('buildPaginatedResponse', () => {
    it('wraps data with success flag and meta', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const result = buildPaginatedResponse(items, 50, 2, 10);

      expect(result).toEqual({
        success: true,
        data: items,
        meta: {
          total: 50,
          page: 2,
          limit: 10,
          totalPages: 5,
        },
      });
    });
  });
});
