import { DEFAULT_RAMADAN_DATE_TOLERANCE_DAYS, RAMADAN_DATE_RANGES, type RamadanRange } from './config/ramadanDates';

export const DEFAULT_RAMADAN_TIMEZONE = 'Africa/Casablanca';
const DEFAULT_DAY_CLOSE_TIME_MINUTES = 19 * 60;
const MAX_DAILY_VOLUNTEERS = 120;
const TARGET_OPEN_DAYS = 3;

type RamadanDayAvailabilityInput = {
  id: number;
  date: string;
  capacity: number;
  registeredCount?: number | null;
};

type ResolveRamadanDayAvailabilityOptions = {
  now?: Date;
  timeZone?: string;
  closeTimeMinutes?: number;
  maxDailyVolunteers?: number;
  targetOpenDays?: number;
};

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

export function getTimeInMinutesInTimeZone(date: Date, timeZone = DEFAULT_RAMADAN_TIMEZONE): number {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return hour * 60 + minute;
}

export function resolveRamadanDayAvailability(
  days: RamadanDayAvailabilityInput[],
  options: ResolveRamadanDayAvailabilityOptions = {}
): Set<number> {
  const now = options.now ?? new Date();
  const timeZone = options.timeZone ?? DEFAULT_RAMADAN_TIMEZONE;
  const closeTimeMinutes = options.closeTimeMinutes ?? DEFAULT_DAY_CLOSE_TIME_MINUTES;
  const maxDailyVolunteers = options.maxDailyVolunteers ?? MAX_DAILY_VOLUNTEERS;
  const targetOpenDays = options.targetOpenDays ?? TARGET_OPEN_DAYS;

  const todayDateString = getDateStringInTimeZone(now, timeZone);
  const currentTimeMinutes = getTimeInMinutesInTimeZone(now, timeZone);

  const openDayIds = days
    .filter((day) => {
      const effectiveCapacity = Math.min(day.capacity, maxDailyVolunteers);
      const isFull = (day.registeredCount ?? 0) >= effectiveCapacity;
      if (isFull) return false;

      if (day.date < todayDateString) return false;
      if (day.date === todayDateString && currentTimeMinutes >= closeTimeMinutes) {
        return false;
      }

      return true;
    })
    .slice(0, targetOpenDays)
    .map((day) => day.id);

  return new Set(openDayIds);
}

function clampToleranceDays(toleranceDays: number): number {
  if (!Number.isFinite(toleranceDays) || toleranceDays < 0) {
    return DEFAULT_RAMADAN_DATE_TOLERANCE_DAYS;
  }

  return Math.floor(toleranceDays);
}

export function isDateWithinRamadanRange(dateString: string, range: RamadanRange, toleranceDays = DEFAULT_RAMADAN_DATE_TOLERANCE_DAYS): boolean {
  const tolerance = clampToleranceDays(toleranceDays);
  const start = addDaysToDateString(range.startDate, -tolerance);
  const end = addDaysToDateString(range.endDate, tolerance);

  return dateString >= start && dateString <= end;
}

export function getRamadanRangeForDate(dateString: string, toleranceDays = DEFAULT_RAMADAN_DATE_TOLERANCE_DAYS): RamadanRange | null {
  return RAMADAN_DATE_RANGES.find((range) => isDateWithinRamadanRange(dateString, range, toleranceDays)) ?? null;
}

export function isInConfiguredRamadan(date: Date = new Date(), options: { timeZone?: string; toleranceDays?: number } = {}): boolean {
  const timeZone = options.timeZone ?? DEFAULT_RAMADAN_TIMEZONE;
  const dateString = getDateStringInTimeZone(date, timeZone);
  return getRamadanRangeForDate(dateString, options.toleranceDays) !== null;
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
