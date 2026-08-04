import * as z from 'zod';

export const PHONE_REGEX = /^(?:\+?237)?6\d{8}$/;

export const PHONE_ERROR =
  'Enter a valid Cameroonian mobile number (e.g. 695123456 or 237695123456)';

export const phoneRequired = (message = PHONE_ERROR) =>
  z.string().regex(PHONE_REGEX, { error: message });

export const phoneOptional = (message = PHONE_ERROR) =>
  z
    .string()
    .optional()
    .refine((v) => !v || PHONE_REGEX.test(v), { error: message });
