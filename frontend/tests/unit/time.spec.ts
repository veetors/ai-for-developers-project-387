import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, isWithinBookingWindow, todayInTz } from '@/api/time';

describe('tz-aware time helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('todayInTz', () => {
    it('returns date in the given tz regardless of system timezone', () => {
      vi.setSystemTime(new Date('2026-08-12T22:00:00Z')); // 01:00 МСК следующего дня
      expect(todayInTz('Europe/Moscow')).toBe('2026-08-13');
      // 03:00 UTC+5 — та же календарная дата
      expect(todayInTz('Asia/Yekaterinburg')).toBe('2026-08-13');
      // 18:00 EDT — ещё предыдущий день
      expect(todayInTz('America/New_York')).toBe('2026-08-12');
    });

    it('does not change around midnight when system clock is UTC', () => {
      vi.setSystemTime(new Date('2026-08-12T20:59:00Z')); // 23:59 МСК того же дня
      expect(todayInTz('Europe/Moscow')).toBe('2026-08-12');
      vi.setSystemTime(new Date('2026-08-12T21:01:00Z')); // 00:01 МСК следующего дня
      expect(todayInTz('Europe/Moscow')).toBe('2026-08-13');
    });
  });

  describe('addDays', () => {
    it('keeps tz semantics when system clock is far away', () => {
      vi.setSystemTime(new Date('2026-09-01T01:00:00Z'));
      expect(addDays('2026-08-30', 1, 'Europe/Moscow')).toBe('2026-08-31');
      expect(addDays('2026-08-30', 5, 'Europe/Moscow')).toBe('2026-09-04');
      expect(addDays('2026-12-31', 1, 'Europe/Moscow')).toBe('2027-01-01');
    });
  });

  describe('isWithinBookingWindow', () => {
    it('includes today and today+13', () => {
      vi.setSystemTime(new Date('2026-08-12T12:00:00+03:00'));
      expect(isWithinBookingWindow('2026-08-12', 'Europe/Moscow')).toBe(true);
      expect(isWithinBookingWindow('2026-08-25', 'Europe/Moscow')).toBe(true);
    });

    it('excludes past and beyond', () => {
      vi.setSystemTime(new Date('2026-08-12T12:00:00+03:00'));
      expect(isWithinBookingWindow('2026-08-11', 'Europe/Moscow')).toBe(false);
      expect(isWithinBookingWindow('2026-08-26', 'Europe/Moscow')).toBe(false);
    });
  });
});