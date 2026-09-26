/**
 * L3 - log payloads become queryable JSON fields.
 *
 * Every call site logs `logger.log('Contact digest sent %o', { count, pending })`
 * (`logging-metadata.spec.ts` requires the placeholder). nestjs-pino hands that
 * to pino as `({ context }, 'Contact digest sent %o', { count, pending })`, and
 * pino serialises the object INTO the message, where CloudWatch Insights cannot
 * filter on `count`. This `hooks.logMethod` lifts a single plain-object payload
 * to top-level fields and keeps the words as the message, at one point instead
 * of 161 call sites.
 *
 * A payload key that would overwrite one of pino's own fields goes under `data`
 * instead - except an Error under `err`, which is lifted so pino-http's
 * serializer writes its type, message and stack (anywhere else pino writes an
 * Error as `{}`; `log-errors-in-err.spec.ts` holds every call site to `err`).
 * An Error, an array, or anything but a plain object as the whole payload is
 * left to pino's interpolation exactly as before.
 */
const RESERVED = new Set([
  'level',
  'time',
  'msg',
  'pid',
  'hostname',
  'context',
  'req',
  'res',
  'err',
  'responseTime',
  'correlationId',
  'data',
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

type LogArgs = unknown[];

export function structuredFieldsHook(
  this: unknown,
  args: LogArgs,
  method: (...args: LogArgs) => void,
): void {
  const [bindings, message, payload, ...rest] = args;
  if (
    rest.length === 0 &&
    isPlainObject(bindings) &&
    typeof message === 'string' &&
    /\s?%o$/.test(message) &&
    isPlainObject(payload)
  ) {
    const fields: Record<string, unknown> = {};
    const collided: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === 'err' && value instanceof Error && !(key in bindings)) fields[key] = value;
      else if (RESERVED.has(key) || key in bindings) collided[key] = value;
      else fields[key] = value;
    }
    const merged = {
      ...bindings,
      ...fields,
      ...(Object.keys(collided).length ? { data: collided } : {}),
    };
    method.apply(this, [merged, message.replace(/\s?%o$/, '')]);
    return;
  }
  method.apply(this, args);
}
