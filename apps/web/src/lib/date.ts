import { DateTime } from 'luxon';

export const formatDate = (dateStr: string, locale: string): string => {
  return DateTime.fromISO(dateStr).setLocale(locale).toLocaleString(DateTime.DATE_FULL);
};
