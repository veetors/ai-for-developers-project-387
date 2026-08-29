import { formatAdminBookingTime, formatSlotRange, DEFAULT_TZ } from '@/api/time';
import { toZonedTime } from 'date-fns-tz';

export { formatAdminBookingTime, formatSlotRange };

export function formatDate(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTime(iso: string, tz: string = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatLocalDate(dateYmd: string, tz: string = DEFAULT_TZ): string {
  const instant = toZonedTime(`${dateYmd}T12:00:00`, tz);
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: tz,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(instant);
}