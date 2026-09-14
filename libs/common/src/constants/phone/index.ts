// A8. The clients are the diaspora - Cameroonians abroad buying land back home -
// so the phone field must accept a French, Belgian, Canadian or any other
// international number, not only a Cameroonian one. This was already true of the
// contact form; here it becomes true of registration, the profile, a land
// client and a KAMNET application too.
//
// The old regex was /^(?:\+?237)?6\d{8}$/ - Cameroon mobile only. This mirrors
// the shape the contact DTO already settled on: an optional international
// prefix, then digits and the separators people actually type. Length-bounded so
// it is a phone number, not lenient enough to pretend it validates a specific
// country's plan - that is what a full libphonenumber pass would add later.
export const PHONE_REGEX = /^\+?[0-9 ().-]{6,20}$/;

export const PHONE_ERROR =
  'Enter a valid phone number with its international prefix (e.g. +237 6 95 12 34 56 or +33 6 12 34 56 78)';
