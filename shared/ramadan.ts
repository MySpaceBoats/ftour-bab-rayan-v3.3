export const DEFAULT_RAMADAN_TIMEZONE = 'Africa/Casablanca';

export function getDateStringInTimeZone(date: Date, timeZone = DEFAULT_RAMADAN_TIMEZONE): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unable to format date in timezone');
  }

  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + days);
  return utcDate.toISOString().slice(0, 10);
}

export function getRamadanDay(todayDateString: string, startDateString: string): number | null {
  const todayUtc = Date.parse(`${todayDateString}T00:00:00.000Z`);
  const startUtc = Date.parse(`${startDateString}T00:00:00.000Z`);
  const deltaDays = Math.floor((todayUtc - startUtc) / 86400000);

  if (deltaDays < 0) {
    return null;
  }

  return deltaDays + 1;
}
