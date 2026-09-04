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
});
