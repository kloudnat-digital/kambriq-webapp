import { of, lastValueFrom } from 'rxjs';
import { TransformResponseInterceptor } from '../../interceptors/transform-response.interceptor';

/**
 * Money is integer money in the database (`BigInt`), and `JSON.stringify`
 * throws on a BigInt. The response envelope is the one place every answer goes
 * through, so it converts there: a BigInt leaves as a number when that number
 * is exact (every realistic XAF amount), and as a string when it would not be -
 * never a crash, never a rounded amount.
 */
const through = (data: unknown) =>
  lastValueFrom(
    new TransformResponseInterceptor().intercept({} as never, { handle: () => of(data) }),
  ) as Promise<{ success: boolean; data: unknown }>;

describe('money leaves the API as JSON, exactly', () => {
  it('a land row with a BigInt total serialises, as a number', async () => {
    const res = await through({ id: 'l1', totalPrice: 3_400_000n, pricePerM2: 7083 });
    expect(JSON.parse(JSON.stringify(res))).toEqual({
      success: true,
      data: { id: 'l1', totalPrice: 3_400_000, pricePerM2: 7083 },
    });
  });

  it('reaches BigInts nested in arrays and objects', async () => {
    const res = await through([{ land: { totalPrice: 8_000_000n } }]);
    expect(JSON.parse(JSON.stringify(res)).data).toEqual([{ land: { totalPrice: 8_000_000 } }]);
  });

  it('never rounds: a BigInt past the exact range leaves as a string', async () => {
    const huge = 2n ** 60n;
    const res = await through({ amount: huge });
    expect(JSON.parse(JSON.stringify(res)).data).toEqual({ amount: huge.toString() });
  });

  it('leaves dates and everything else as they were', async () => {
    const at = new Date('2026-09-26T00:00:00Z');
    const res = await through({ at, n: 1, s: 'x', none: null });
    expect(res.data).toEqual({ at, n: 1, s: 'x', none: null });
  });
});
