import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  isWithinBookingWindow,
  todayInTz,
  formatTzName,
  DEFAULT_TZ,
} from '@/api/time';

describe('timezone-aware time helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('todayInTz', () => {
    it('returns date in the target timezone regardless of system timezone', () => {
      vi.setSystemTime(new Date('2026-08-12T22:00:00Z')); // 01:00 MSK следующего дня
      expect(todayInTz(DEFAULT_TZ)).toBe('2026-08-13');
    });

    it('does not change around midnight when system clock is UTC', () => {
      vi.setSystemTime(new Date('2026-08-12T20:59:00Z')); // 23:59 MSK того же дня
      expect(todayInTz(DEFAULT_TZ)).toBe('2026-08-12');
      vi.setSystemTime(new Date('2026-08-12T21:01:00Z')); // 00:01 MSK следующего дня
      expect(todayInTz(DEFAULT_TZ)).toBe('2026-08-13');
    });

    it('differs per timezone for the same instant', () => {
      // 22:00 UTC = 01:00 MSK (+3) next day, but still 18:00 EDT (-4) the same day.
      vi.setSystemTime(new Date('2026-08-12T22:00:00Z'));
      expect(todayInTz(DEFAULT_TZ)).toBe('2026-08-13');
      expect(todayInTz('America/New_York')).toBe('2026-08-12');
    });
  });

  describe('addDays', () => {
    it('adds days in the target timezone when system clock is far away', () => {
      vi.setSystemTime(new Date('2026-09-01T01:00:00Z'));
      expect(addDays('2026-08-30', 1, DEFAULT_TZ)).toBe('2026-08-31');
      expect(addDays('2026-08-30', 5, DEFAULT_TZ)).toBe('2026-09-04');
      expect(addDays('2026-12-31', 1, DEFAULT_TZ)).toBe('2027-01-01');
    });
  });

  describe('isWithinBookingWindow', () => {
    it('includes today and today+13', () => {
      vi.setSystemTime(new Date('2026-08-12T12:00:00+03:00'));
      expect(isWithinBookingWindow('2026-08-12', DEFAULT_TZ)).toBe(true);
      expect(isWithinBookingWindow('2026-08-25', DEFAULT_TZ)).toBe(true);
    });

    it('excludes past and beyond', () => {
      vi.setSystemTime(new Date('2026-08-12T12:00:00+03:00'));
      expect(isWithinBookingWindow('2026-08-11', DEFAULT_TZ)).toBe(false);
      expect(isWithinBookingWindow('2026-08-26', DEFAULT_TZ)).toBe(false);
    });
  });

  describe('formatTzName', () => {
    it('turns an IANA id into a compact city name', () => {
      expect(formatTzName('Europe/Moscow')).toBe('Moscow');
      expect(formatTzName('America/New_York')).toBe('New York');
      expect(formatTzName('Asia/Tokyo')).toBe('Tokyo');
    });
  });
});
