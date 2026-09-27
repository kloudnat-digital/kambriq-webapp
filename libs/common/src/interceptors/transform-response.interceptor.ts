import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}
/**
 * Money is integer money in the database (`BigInt`), and `JSON.stringify` throws
 * on a BigInt. Every answer passes here, so a BigInt is converted once, at the
 * edge: to a number when that number is exact (every realistic XAF amount), to a
 * string otherwise - never rounded. Only plain objects and arrays are walked;
 * dates and other instances pass untouched.
 */
const jsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, jsonSafe(v)]));
  }
  return value;
};

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // Pass through pre-wrapped responses.
        if (data && typeof data === 'object' && 'success' in data) {
          return jsonSafe(data) as ApiResponse<T>;
        }
        return {
          success: true,
          data: jsonSafe(data) as T,
        };
      }),
    );
  }
}
