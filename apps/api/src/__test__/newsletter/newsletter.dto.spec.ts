import { subscribeNewsletterSchema } from '../../newsletter/newsletter.dto';

/**
 * P2 - **the server refuses what the browser refuses, whatever the browser did.**
 *
 * The newsletter form runs a zod resolver in the browser. That is a courtesy to
 * the person filling it in and it is not a guard: the route is public, it takes
 * JSON, and anything at all can post to it. Same shape as
 * `contact.dto.spec.ts`, for the same reason.
 */
const valid = { email: 'reader@example.test', locale: 'fr', consent: true };

describe('P2 - a newsletter subscription is validated on the server', () => {
  it('accepts a well-formed subscription', () => {
    expect(subscribeNewsletterSchema.safeParse(valid).success).toBe(true);
  });

  it('defaults the locale to fr, the site language, when none is sent', () => {
    const result = subscribeNewsletterSchema.safeParse({ email: valid.email, consent: true });
    expect(result.success && result.data.locale).toBe('fr');
  });

  it.each([
    ['without consent', { email: valid.email, locale: 'fr' }],
    ['with consent false', { ...valid, consent: false }],
    ['with consent as the string "true"', { ...valid, consent: 'true' }],
    ['with consent as 1', { ...valid, consent: 1 }],
  ])('refuses a subscription %s', (_label, body) => {
    expect(subscribeNewsletterSchema.safeParse(body).success).toBe(false);
  });

  it.each([
    ['an unparseable address', { ...valid, email: 'not-an-address' }],
    ['an empty address', { ...valid, email: '' }],
    ['a locale outside the published pair', { ...valid, locale: 'de' }],
  ])('refuses %s', (_label, body) => {
    expect(subscribeNewsletterSchema.safeParse(body).success).toBe(false);
  });

  it('does not accept a consent time from the wire', () => {
    const result = subscribeNewsletterSchema.safeParse({
      ...valid,
      consentGivenAt: '2020-01-01T00:00:00.000Z',
    });
    expect(result.success && 'consentGivenAt' in result.data).toBe(false);
  });
});
