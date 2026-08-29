import { describe, expect, it } from 'vitest';
import { formatSlotRange } from '@/lib/formatters';
import { formatAdminBookingTime } from '@/lib/formatters';
import { DEFAULT_TZ } from '@/api/time';

describe('formatSlotRange', () => {
  it('formats start..end as HH:mm — HH:mm in the target timezone', () => {
    expect(
      formatSlotRange('2026-08-12T06:00:00+03:00', '2026-08-12T06:30:00+03:00', DEFAULT_TZ),
    ).toBe('06:00 — 06:30');
  });

  it('accepts UTC ISO (converted to the target timezone)', () => {
    expect(
      formatSlotRange('2026-08-12T03:00:00Z', '2026-08-12T03:30:00Z', DEFAULT_TZ),
    ).toBe('06:00 — 06:30');
  });

  it('rolls past midnight in inverse TZ', () => {
    expect(
      formatSlotRange('2026-08-12T21:30:00Z', '2026-08-12T22:00:00Z', DEFAULT_TZ),
    ).toBe('00:30 — 01:00');
  });
});

describe('formatAdminBookingTime', () => {
  it('renders long-form datetime in ru-RU for the target timezone', () => {
    expect(formatAdminBookingTime('2026-08-31T09:30:00+03:00', DEFAULT_TZ)).toContain('9:30');
    expect(formatAdminBookingTime('2026-08-31T09:30:00+03:00', DEFAULT_TZ)).toMatch(/августа|31/);
  });
});
