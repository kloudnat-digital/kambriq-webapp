import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: Record<string, unknown>;
}
/**
 * Money is integer money in the database (`BigInt`), and `JSON.stringify` throws
 * on a BigInt. Every answer passes here, so a BigInt is converted once at the
 * edge: to a number where that number is exact, to a string past 2^53, never
 * rounded.
 *
 * Every object is walked except one that defines its own `toJSON` - a `Date`, a
 * `Buffer`, a `Decimal`. Those already control their serialised form and must
 * reach it unchanged. Restricting the walk to plain objects instead left a BigInt
 * inside any class instance unconverted, which is a 500 on that response rather
 * than a wrong value; `envelope-contract.spec.ts` holds the case.
 *
 * Walking an instance returns a plain object, and nothing observable changes: the
 * value is about to be JSON, where the prototype is lost either way, and only own
 * enumerable properties survive - exactly what `JSON.stringify` would have taken.
 */
const hasOwnToJson = (value: object): boolean =>
  typeof (value as { toJSON?: unknown }).toJSON === 'function';

const jsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === 'object' && !hasOwnToJson(value)) {
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
