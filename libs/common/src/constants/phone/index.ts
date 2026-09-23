// Validates international phone numbers.
// Accepts an optional international prefix, digits, and common separators (spaces, dots, hyphens, parentheses).
// Note: This provides basic structural validation, not country-specific formatting checks.
export const PHONE_REGEX = /^\+?[0-9 ().-]{6,20}$/;

export const PHONE_ERROR =
  'Enter a valid phone number with its international prefix (e.g. +237 6 95 12 34 56 or +33 6 12 34 56 78)';
