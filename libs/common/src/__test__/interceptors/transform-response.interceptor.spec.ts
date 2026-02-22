import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { TransformResponseInterceptor } from '../..';

describe('TransformResponseInterceptor', () => {
  let interceptor: TransformResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformResponseInterceptor();
  });

  const mockContext = {} as unknown as ExecutionContext;
  const mockHandler = (data: unknown): CallHandler => ({
    handle: () => of(data),
  });

  it('wraps plain data in { success: true, data: ... }', (done) => {
    interceptor
      .intercept(mockContext, mockHandler({ name: 'test' }))
      .subscribe((result) => {
        expect(result).toEqual({
          success: true,
          data: { name: 'test' },
        });
        done();
      });
  });

  it('passes through already-wrapped responses (pagination)', (done) => {
    const paginated = {
      success: true,
      data: [{ id: 1 }],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };

    interceptor
      .intercept(mockContext, mockHandler(paginated))
      .subscribe((result) => {
        expect(result).toEqual(paginated); // unchanged
        done();
      });
  });

  it('wraps null data', (done) => {
    interceptor
      .intercept(mockContext, mockHandler(null))
      .subscribe((result) => {
        expect(result).toEqual({ success: true, data: null });
        done();
      });
  });
});
