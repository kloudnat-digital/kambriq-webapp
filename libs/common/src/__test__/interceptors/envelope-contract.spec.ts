import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { TransformResponseInterceptor } from '../../interceptors/transform-response.interceptor';

/**
 * The envelope contract, asserted on CONTENT — because shape is what the defect
 * preserves.
 *
 * `GET /users` served `{"success":true,"data":[{},{},{}],"meta":{"total":14}}`:
 * 200, correct envelope, correct pagination, and no data. `toUserResponse` is
 * async and the map was not awaited, so every row was a pending Promise and
 * `JSON.stringify` renders a Promise as `{}`.
 *
 * **A contract test that checked `{ success, data }` would have passed that.**
 * So would one that checked `Array.isArray(data)`, or `data.length === 3`, or
 * `meta.total`. Every one of those is true of a list of Promises. The contract
 * these tests enforce is therefore: the envelope is present, AND the payload
 * carries content — no empty objects, nothing that survives serialisation as
 * `{}` or `[object Promise]`.
 *
 * Each module's list endpoints should be asserted the same way. The reusable
 * part is `expectCarriesContent`, exported below.
 */

/** A row is content only if serialising it leaves something behind. */
export const expectCarriesContent = (payload: unknown): void => {
  const rows = Array.isArray(payload) ? payload : [payload];
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row).not.toBeInstanceOf(Promise);
    const serialised = JSON.parse(JSON.stringify(row)) as Record<string, unknown>;
    expect(Object.keys(serialised).length).toBeGreaterThan(0);
    expect(JSON.stringify(row)).not.toContain('[object');
  }
};

class MoneyRow {
  constructor(readonly amount: bigint) {}
}

@Controller('probe')
class ProbeController {
  /** What a healthy list looks like. */
  @Get('rows')
  rows() {
    return [
      { id: '1', email: 'a@kambriq.com' },
      { id: '2', email: 'b@kambriq.com' },
    ];
  }

  /** The defect: async rows that were never awaited. */
  @Get('promises')
  promises() {
    return [Promise.resolve({ id: '1' }), Promise.resolve({ id: '2' })];
  }

  /** Already-wrapped payloads must pass through untouched. */
  @Get('wrapped')
  wrapped() {
    return { success: true, data: [{ id: '1' }], meta: { total: 1, page: 1 } };
  }

  /** Money is a BigInt in every schema, and `JSON.stringify` throws on one. */
  @Get('money')
  money() {
    return { amount: 750_000n, nested: { total: 1_500_000n }, list: [42n] };
  }

  /** Past 2^53 an exact number is impossible, so the value must survive as a string. */
  @Get('huge')
  huge() {
    return { amount: 9_007_199_254_740_993n };
  }

  /** A Date defines its own toJSON, so the walk must leave it alone. */
  @Get('dated')
  dated() {
    return { createdAt: new Date('2026-09-27T10:00:00.000Z'), amount: 5n };
  }

  /** A BigInt inside a class instance, which is not a plain object. */
  @Get('instance')
  instance() {
    return { row: new MoneyRow(750_000n) };
  }

  /** `meta` is part of a pre-wrapped answer and is walked the same way. */
  @Get('wrapped-money')
  wrappedMoney() {
    return { success: true, data: [{ amount: 1n }], meta: { total: 2n } };
  }
}

@Module({ controllers: [ProbeController] })
class ProbeModule {}

describe('response envelope contract', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useLogger(false);
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.listen(0);
    base = await app.getUrl();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('wraps a plain payload in { success, data }', async () => {
    const body = (await (await fetch(`${base}/probe/rows`)).json()) as {
      success: boolean;
      data: unknown;
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('carries content, not just shape', async () => {
    const body = (await (await fetch(`${base}/probe/rows`)).json()) as { data: unknown };
    expectCarriesContent(body.data);
  });

  /**
   * The assertion that would have caught the live defect.
   *
   * This route is the defect, reproduced: the shape checks all pass and the
   * content check does not. If `expectCarriesContent` is ever weakened, this
   * test starts passing — which is the signal that it has stopped doing its job.
   */
  it('rejects a list of unawaited promises, which every shape check accepts', async () => {
    const body = (await (await fetch(`${base}/probe/promises`)).json()) as {
      success: boolean;
      data: unknown[];
    };

    // Every shape assertion passes.
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(2);

    // And the rows are empty.
    expect(body.data[0]).toEqual({});
    expect(() => expectCarriesContent(body.data)).toThrow();
  });

  it('passes an already-wrapped payload through, meta intact', async () => {
    const body = (await (await fetch(`${base}/probe/wrapped`)).json()) as {
      success: boolean;
      data: unknown;
      meta: { total: number };
    };
    expect(body.meta.total).toBe(1);
    expect(body).not.toHaveProperty('data.data'); // not double-wrapped
    expectCarriesContent(body.data);
  });

  /**
   * Integer money crossing the wire.
   *
   * `JSON.stringify` throws on a BigInt, so without conversion every response
   * carrying money is a 500. The interceptor converts at the edge; these pin what
   * it converts to, because the answer differs by magnitude.
   */
  describe('integer money', () => {
    it('sends a BigInt as an exact number, at every depth', async () => {
      const res = await fetch(`${base}/probe/money`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: { amount: number; nested: { total: number }; list: number[] };
      };

      expect(body.data).toEqual({ amount: 750000, nested: { total: 1500000 }, list: [42] });
      expect(typeof body.data.amount).toBe('number');
    });

    it('sends a value past 2^53 as a string rather than rounding it', async () => {
      // 9007199254740993 has no exact double. A number here would be off by one,
      // and money that is off by one is worse than money that is a string.
      const body = (await (await fetch(`${base}/probe/huge`)).json()) as {
        data: { amount: unknown };
      };

      expect(body.data.amount).toBe('9007199254740993');
    });

    it('converts a BigInt inside meta on a pre-wrapped answer', async () => {
      const body = (await (await fetch(`${base}/probe/wrapped-money`)).json()) as {
        data: { amount: number }[];
        meta: { total: number };
      };

      expect(body.meta.total).toBe(2);
      expect(body.data[0].amount).toBe(1);
    });

    it('leaves a Date to its own toJSON, beside a converted BigInt', async () => {
      // The walk now enters any object without a toJSON. A Date has one, and
      // walking it would send {} where every createdAt in the API belongs.
      const body = (await (await fetch(`${base}/probe/dated`)).json()) as {
        data: { createdAt: string; amount: number };
      };

      expect(body.data).toEqual({ createdAt: '2026-09-27T10:00:00.000Z', amount: 5 });
    });

    it('converts a BigInt held by a class instance', async () => {
      // The conversion walks arrays and plain objects. A class instance is
      // neither, so a BigInt inside one reached `JSON.stringify` and threw.
      const res = await fetch(`${base}/probe/instance`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { row: { amount: number } } };

      expect(body.data.row.amount).toBe(750000);
    });
  });
});
