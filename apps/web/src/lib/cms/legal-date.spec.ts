import { legalDate } from './legal-date';

/**
 * C41 - a text in force from local midnight on the 19th is dated the 19th, on a
 * server that runs in UTC as well as anywhere else.
 */
describe('C41 - a legal date is the day it takes effect locally', () => {
  it('dates 2026-10-19T00:00:00+01:00 as the 19th, in both languages', () => {
    expect(legalDate('2026-10-18T23:00:00.000Z', 'fr')).toBe('19 octobre 2026');
    expect(legalDate('2026-10-19T00:00:00+01:00', 'en')).toBe('October 19, 2026');
  });

  it('is what a UTC formatter gets wrong', () => {
    const utc = new Intl.DateTimeFormat('fr', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date('2026-10-18T23:00:00.000Z'));
    expect(utc).toBe('18 octobre 2026');
  });
});
