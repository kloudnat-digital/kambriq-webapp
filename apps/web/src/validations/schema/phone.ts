import * as z from 'zod';

// A8. International, not Cameroon-only - the clients are the diaspora.
export const PHONE_REGEX = /^\+?[0-9 ().-]{6,20}$/;

export const PHONE_ERROR =
  'Enter a valid phone number with its international prefix (e.g. +237 6 95 12 34 56 or +33 6 12 34 56 78)';

export const phoneRequired = (message = PHONE_ERROR) =>
  z.string().regex(PHONE_REGEX, { error: message });

export const phoneOptional = (message = PHONE_ERROR) =>
  z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), { error: message });
