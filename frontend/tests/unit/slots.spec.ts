import { describe, expect, it } from 'vitest';
import { formatSlotRange } from '@/lib/formatters';
import { formatAdminBookingTime } from '@/lib/formatters';

describe('formatSlotRange', () => {
  it('formats start..end as HH:mm — HH:mm in given tz', () => {
    expect(
      formatSlotRange('2026-08-12T06:00:00+03:00', '2026-08-12T06:30:00+03:00', 'Europe/Moscow'),
    ).toBe('06:00 — 06:30');
  });

  it('accepts UTC ISO (converted to tz)', () => {
    expect(
      formatSlotRange('2026-08-12T03:00:00Z', '2026-08-12T03:30:00Z', 'Europe/Moscow'),
    ).toBe('06:00 — 06:30');
  });

  it('rolls past midnight in inverse TZ', () => {
    expect(
      formatSlotRange('2026-08-12T21:30:00Z', '2026-08-12T22:00:00Z', 'Europe/Moscow'),
    ).toBe('00:30 — 01:00');
  });

  it('renders in non-MSK timezone', () => {
    expect(
      formatSlotRange('2026-08-12T03:00:00Z', '2026-08-12T03:30:00Z', 'Asia/Yekaterinburg'),
    ).toBe('08:00 — 08:30');
  });
});

describe('formatAdminBookingTime', () => {
  it('renders long-form datetime in ru-RU', () => {
    expect(formatAdminBookingTime('2026-08-31T09:30:00+03:00', 'Europe/Moscow')).toContain('9:30');
    expect(formatAdminBookingTime('2026-08-31T09:30:00+03:00', 'Europe/Moscow')).toMatch(
      /августа|31/,
    );
  });
});