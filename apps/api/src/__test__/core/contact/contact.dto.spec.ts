import { ContactSubject } from '@kambriq/common';
import { submitContactRequestSchema } from '../../../core/contact/contact.dto';

/**
 * L1 - **the server validates, whatever the browser did.**
 *
 * The contact form runs a zod resolver in the browser. That is a courtesy to
 * the person filling it in and it is not a guard: the route is public, it takes
 * JSON, and anything at all can post to it. This file is the guard, and it is
 * what goes red when server-side validation is removed.
 *
 * Mutation proof: deleting the field rules from `submitContactRequestSchema`
 * turns each `success: false` below into `success: true`. The failures are
 * quoted in the PR.
 */
const valid = {
  name: 'Amina Nkolo',
  email: 'prospect@example.test',
  phone: '+33 6 12 34 56 78',
  subject: ContactSubject.LANDS,
  message: 'Je cherche une parcelle titree dans le Littoral.',
  locale: 'fr',
  consent: true,
};

describe('L1 - the contact request is validated on the server', () => {
  it('accepts a well-formed request', () => {
    const result = submitContactRequestSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it.each([
    ['name', '', 'an empty name'],
    ['name', '   ', 'a whitespace name'],
    ['name', 'A', 'a one-character name'],
    ['email', 'not-an-address', 'an unparseable address'],
    ['email', '', 'an empty address'],
    ['message', 'too short', 'a message under ten characters'],
    ['message', '   ', 'a whitespace message'],
    ['subject', 'PARCELS', 'a subject outside the six'],
    ['locale', 'de', 'a locale the site is not published in'],
  ])('refuses %s = %p (%s)', (field, value) => {
    const result = submitContactRequestSchema.safeParse({ ...valid, [field]: value });
    expect(result.success).toBe(false);
  });

  it('refuses a request whose consent is missing, false, or a truthy impostor', () => {
    // `z.literal(true)` rather than `z.boolean()`: the second would accept
    // `false` and leave the service to remember to check it.
    for (const consent of [undefined, false, 'true', 1, 'yes']) {
      const result = submitContactRequestSchema.safeParse({ ...valid, consent });
      expect(result.success).toBe(false);
    }
  });

  it('does not accept a consent timestamp from the caller', () => {
    // A consent time supplied by a client is a claim about the past. It is not
    // in the schema at all, so zod strips it and the service uses its own clock.
    const parsed = submitContactRequestSchema.parse({
      ...valid,
      consentGivenAt: '2020-01-01T00:00:00.000Z',
    });
    expect(parsed).not.toHaveProperty('consentGivenAt');
  });

  it('trims before it measures, so whitespace is not content', () => {
    const parsed = submitContactRequestSchema.parse({
      ...valid,
      name: '  Amina Nkolo  ',
      message: `  ${valid.message}  `,
    });
    expect(parsed.name).toBe('Amina Nkolo');
    expect(parsed.message).toBe(valid.message);
  });

  it('the phone is optional, and an empty string means "not given"', () => {
    expect(submitContactRequestSchema.parse({ ...valid, phone: '' }).phone).toBeUndefined();
    const withoutPhone: Record<string, unknown> = { ...valid };
    delete withoutPhone['phone'];
    expect(submitContactRequestSchema.safeParse(withoutPhone).success).toBe(true);
  });

  it.each(['+237 6 12 34 56 78', '+33 6 12 34 56 78', '+1 (514) 555-0134', '+44 20 7946 0958'])(
    'accepts the international number %s',
    (phone) => {
      // The design's client base is the diaspora. A pattern that only accepted
      // +237 would refuse most of the people this form exists to hear from.
      expect(submitContactRequestSchema.safeParse({ ...valid, phone }).success).toBe(true);
    },
  );

  it('refuses a phone number that is not one', () => {
    expect(submitContactRequestSchema.safeParse({ ...valid, phone: 'call me' }).success).toBe(
      false,
    );
  });

  it('defaults the locale to French rather than rejecting a request without one', () => {
    const withoutLocale: Record<string, unknown> = { ...valid };
    delete withoutLocale['locale'];
    const parsed = submitContactRequestSchema.parse(withoutLocale);
    expect(parsed.locale).toBe('fr');
  });

  it('refuses a message longer than the column is meant to hold', () => {
    const result = submitContactRequestSchema.safeParse({ ...valid, message: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });

  it('the six subjects it accepts are the six the enum declares', () => {
    // Pinned in both directions: a subject added to the enum and not offered by
    // the form is as much a defect as one the form offers and the API refuses.
    for (const subject of Object.values(ContactSubject)) {
      expect(submitContactRequestSchema.safeParse({ ...valid, subject }).success).toBe(true);
    }
  });
});
