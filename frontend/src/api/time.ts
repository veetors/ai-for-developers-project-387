import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const DEFAULT_TZ = 'Europe/Moscow';

export function todayInTz(tz: string): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

export function addDays(date: string, n: number, tz: string): string {
  const zoned = toZonedTime(`${date}T00:00:00`, tz);
  const shifted = new Date(zoned.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + n);
  return format(shifted, 'yyyy-MM-dd');
}

export function isWithinBookingWindow(date: string, tz: string): boolean {
  const from = todayInTz(tz);
  const to = addDays(from, 13, tz);
  return date >= from && date <= to;
}

export function formatSlotRange(startIso: string, endIso: string, tz: string): string {
  const start = formatInTimeZone(startIso, tz, 'HH:mm');
  const end = formatInTimeZone(endIso, tz, 'HH:mm');
  return `${start} — ${end}`;
}

export function formatAdminBookingTime(iso: string, tz: string): string {
  return formatInTimeZone(iso, tz, "d MMMM yyyy 'г.,' HH:mm");
}

export function formatIsoDateInTz(iso: string, tz: string): string {
  return formatInTimeZone(iso, tz, 'yyyy-MM-dd');
}

export function formatHumanDateInTz(iso: string, tz: string): string {
  return formatInTimeZone(iso, tz, 'd MMMM yyyy');
}

export function formatTzName(tz: string): string {
  const city = tz.split('/').at(-1) ?? tz;
  return city.replace(/_/g, ' ');
}
