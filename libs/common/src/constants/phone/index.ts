// Validates international phone numbers.
// Asserts basic structure (digits, prefix, separators) without country-specific formatting rules.
export const PHONE_REGEX = /^\+?[0-9 ().-]{6,20}$/;

export const PHONE_ERROR =
  'Enter a valid phone number with its international prefix (e.g. +237 6 95 12 34 56 or +33 6 12 34 56 78)';
