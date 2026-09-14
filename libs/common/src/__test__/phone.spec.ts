import { PHONE_REGEX } from '../constants/phone';

/**
 * A8 - the clients are the diaspora, so the phone field must accept their
 * numbers. It used to be Cameroon-mobile-only (/^(?:\+?237)?6\d{8}$/), which
 * refused exactly the customer this platform is built for.
 */
describe('PHONE_REGEX', () => {
  it.each([
    ['695123456', 'a bare Cameroonian mobile (backward compatible)'],
    ['+237695123456', 'a Cameroonian number with its prefix'],
    ['+33 6 12 34 56 78', 'a French diaspora number'],
    ['+32 471 23 45 67', 'a Belgian number'],
    ['+1 (514) 555-0134', 'a Canadian number with formatting'],
    ['+44 20 7946 0958', 'a British number'],
  ])('accepts %s (%s)', (value) => {
    expect(PHONE_REGEX.test(value)).toBe(true);
  });

  it.each([
    ['12', 'too short to be a phone number'],
    ['not-a-number', 'letters'],
    ['', 'empty'],
  ])('rejects %s (%s)', (value) => {
    expect(PHONE_REGEX.test(value)).toBe(false);
  });
});
