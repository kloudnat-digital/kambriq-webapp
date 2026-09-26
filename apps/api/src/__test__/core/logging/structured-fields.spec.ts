import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import { structuredFieldsHook } from '../../../core/logging/structured-fields';

/**
 * L3 - a log line's payload is queryable. Every call site writes
 * `logger.log('Contact digest sent %o', { count, pending })`, which nestjs-pino
 * hands to pino as `({ context }, 'Contact digest sent %o', { ... })`. Without
 * the hook, pino serialises the object INTO the message string, and CloudWatch
 * Insights cannot filter on `count`. With it, the object's keys are fields.
 */
const capture = (withHook: boolean) => {
  const lines: Array<Record<string, unknown>> = [];
  const stream = new Writable({
    write(chunk, _enc, done) {
      lines.push(JSON.parse(chunk.toString()));
      done();
    },
  });
  // pino-http is the logger the API runs (nestjs-pino builds it); its `.logger` is pino itself.
  const { logger } = pinoHttp(
    withHook ? { hooks: { logMethod: structuredFieldsHook } } : {},
    stream,
  );
  return { logger, lines };
};

describe('L3 - log payloads are fields, not text', () => {
  it('writes an Error under `err` with its type, message and stack, never as {}', () => {
    // pino-http serialises a top-level `err`; anywhere else pino writes an Error
    // as `{}`, the message and the stack gone (the rule in log-errors-in-err.spec.ts).
    const { logger, lines } = capture(true);
    logger.warn({ context: 'X' }, 'Email failed %o', { err: new Error('SES refused'), to: 'a' });
    const err = lines[0].err as Record<string, unknown>;
    expect(err).toMatchObject({ type: 'Error', message: 'SES refused' });
    expect(String(err.stack)).toContain('SES refused');
    expect(lines[0]).toMatchObject({ msg: 'Email failed', to: 'a' });
    expect(lines[0].data).toBeUndefined();
  });

  it('shows what the old shape wrote: an Error under any other key is {}', () => {
    const { logger, lines } = capture(true);
    logger.warn({ context: 'X' }, 'Email failed %o', { error: new Error('SES refused') });
    expect(lines[0].error).toEqual({});
  });

  it('lifts the payload to top-level fields and keeps the words as the message', () => {
    const { logger, lines } = capture(true);
    logger.info({ context: 'ContactService' }, 'Contact digest sent %o', { count: 0, pending: 2 });
    expect(lines[0]).toMatchObject({
      context: 'ContactService',
      msg: 'Contact digest sent',
      count: 0,
      pending: 2,
    });
  });

  it("never lets a payload key overwrite one of pino's own fields", () => {
    const { logger, lines } = capture(true);
    logger.info({ context: 'X' }, 'Something %o', { msg: 'mine', level: 'high', id: 'a1' });
    expect(lines[0]).toMatchObject({
      msg: 'Something',
      level: 30,
      id: 'a1',
      data: { msg: 'mine', level: 'high' },
    });
  });

  it('leaves an Error, or anything that is not a plain object, exactly as pino alone does', () => {
    const hooked = capture(true);
    const plain = capture(false);
    for (const { logger } of [hooked, plain]) {
      logger.error({ context: 'X' }, 'Failed %o', new Error('boom'));
      logger.info({ context: 'X' }, 'List %o', [1, 2]);
    }
    const strip = (l: Record<string, unknown>) => ({
      msg: l.msg,
      level: l.level,
      context: l.context,
    });
    expect(hooked.lines.map(strip)).toEqual(plain.lines.map(strip));
  });

  it('without the hook, the payload is text inside the message - the defect', () => {
    const { logger, lines } = capture(false);
    logger.info({ context: 'ContactService' }, 'Contact digest sent %o', { count: 0 });
    expect(lines[0].count).toBeUndefined();
    expect(lines[0].msg).toBe('Contact digest sent {"count":0}');
  });
});

/**
 * The hook is only worth anything if the API's own logger carries it. Read from
 * the module source rather than by booting the app: the option is one line in
 * `LoggerModule.forRootAsync`, and losing it is a one-line edit that no other
 * test would notice.
 */
describe('L3 - the API logger carries the hook', () => {
  it('app.module.ts passes structuredFieldsHook as pino hooks.logMethod', () => {
    const src = readFileSync(join(__dirname, '../../../app/app.module.ts'), 'utf8');
    expect(src).toMatch(/hooks:\s*\{\s*logMethod:\s*structuredFieldsHook\s*\}/);
  });
});
