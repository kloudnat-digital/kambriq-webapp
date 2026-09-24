import 'reflect-metadata';
import { AuthController } from '../../../core/auth/auth.controller';

/**
 * A41 - the five anonymous auth routes carry a rate limit each, chosen against
 * how they are really called.
 *
 * P11 listed them as exempt "inherited and not examined". They could not be
 * examined honestly until A45: every call the web makes for a visitor used to
 * count against the web task's own address, so any limit here would have been
 * a limit on the whole site. With A45 proven on dev, a limit counts per
 * visitor, and these were measured per caller from the API's request log (7
 * days, 17-24 September) before a number was chosen:
 *
 * | route          | peak per caller / 60 s | limit | why                                        |
 * | -------------- | ---------------------- | ----- | ------------------------------------------ |
 * | refresh        | 15 (NextAuth bursts)   | 30    | too low logs people out mid-session        |
 * | logout         | 0 (none in 7 days)     | 10    | one per sign-out; the house auth value     |
 * | verify-email   | 3 (a journeys run)     | 10    | a double click is 2                        |
 * | reset-password | 3 (journey 5)          | 10    | the token cannot be guessed; abuse only    |
 * | reactivate     | 0 (none in 7 days)     | 5     | checks a password, like login              |
 *
 * `@Throttle` records its options as metadata on the handler, keyed by the
 * throttler's name - `default` here, the only one `app.module.ts` declares.
 */
const LIMIT = 'THROTTLER:LIMITdefault';
const TTL = 'THROTTLER:TTLdefault';

const handler = (name: keyof AuthController) =>
  (AuthController.prototype as unknown as Record<string, object>)[name];

describe('A41 - every anonymous auth route has its own rate limit', () => {
  it.each([
    ['refresh', 'refresh', 30],
    ['logout', 'logout', 10],
    ['verify-email', 'verifyEmail', 10],
    ['reset-password', 'changePassword', 10],
    ['reactivate', 'reactivateAccount', 5],
  ] as const)(
    'POST /auth/%s (%s) is throttled at the limit chosen from the measurement',
    (_route, name, limit) => {
      expect(Reflect.getMetadata(LIMIT, handler(name))).toBe(limit);
      expect(Reflect.getMetadata(TTL, handler(name))).toBe(60_000);
    },
  );

  it('reads the handlers it thinks it reads', () => {
    // A renamed handler would make every assertion above read `undefined` from
    // a method that no longer exists; this fails first and says why.
    const paths = ['refresh', 'logout', 'verifyEmail', 'changePassword', 'reactivateAccount'].map(
      (n) => Reflect.getMetadata('path', handler(n as keyof AuthController)),
    );
    expect(paths).toEqual(['refresh', 'logout', 'verify-email', 'reset-password', 'reactivate']);
  });
});
