import { describe, expect, it } from 'vitest';

import { getRamadanRangeForDate, isInConfiguredRamadan } from '@shared/ramadan';

describe('configured ramadan ranges', () => {
  it('matches the exact configured 2029 range', () => {
    expect(getRamadanRangeForDate('2029-01-16')?.year).toBe(2029);
    expect(getRamadanRangeForDate('2029-02-15')?.year).toBe(2029);
  });

  it('applies ±1 day tolerance by default', () => {
    expect(getRamadanRangeForDate('2029-01-15')?.year).toBe(2029);
    expect(getRamadanRangeForDate('2029-02-16')?.year).toBe(2029);
  });

  it('does not match outside tolerance', () => {
    expect(getRamadanRangeForDate('2029-01-14')).toBeNull();
    expect(getRamadanRangeForDate('2029-02-17')).toBeNull();
  });

  it('respects Africa/Casablanca timezone in date resolution', () => {
    const utcDate = new Date('2029-01-15T23:30:00.000Z');
    expect(isInConfiguredRamadan(utcDate, { timeZone: 'Africa/Casablanca' })).toBe(true);
  });
});
