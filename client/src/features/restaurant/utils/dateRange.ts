const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Compare des dates au format ISO (YYYY-MM-DD) sans conversion timezone,
 * afin d'éviter les écarts Safari/mobile sur new Date('YYYY-MM-DD').
 */
export function isDateInInclusiveRange(
  date: string,
  minDate: string,
  maxDate: string,
): boolean {
  if (
    !ISO_DATE_PATTERN.test(date) ||
    !ISO_DATE_PATTERN.test(minDate) ||
    !ISO_DATE_PATTERN.test(maxDate)
  ) {
    return false;
  }

  return date >= minDate && date <= maxDate;
}
