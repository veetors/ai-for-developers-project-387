import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const DEFAULT_TZ = 'Europe/Moscow';

export function todayInTz(tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
}

export function addDays(date: string, n: number, tz: string = DEFAULT_TZ): string {
  const zoned = toZonedTime(`${date}T00:00:00`, tz);
  const shifted = new Date(zoned.getTime());
  shifted.setUTCDate(shifted.getUTCDate() + n);
  return format(shifted, 'yyyy-MM-dd');
}

export function isWithinBookingWindow(
  date: string,
  tz: string = DEFAULT_TZ,
): boolean {
  const from = todayInTz(tz);
  const to = addDays(from, 13, tz);
  return date >= from && date <= to;
}

export function formatSlotRange(
  startIso: string,
  endIso: string,
  tz: string = DEFAULT_TZ,
): string {
  const start = formatInTimeZone(startIso, tz, 'HH:mm');
  const end = formatInTimeZone(endIso, tz, 'HH:mm');
  return `${start} — ${end}`;
}

export function formatAdminBookingTime(iso: string, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(iso, tz, "d MMMM yyyy 'г.,' HH:mm");
}

export function formatIsoDate(iso: string, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(iso, tz, 'yyyy-MM-dd');
}

export function formatHumanDate(iso: string, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(iso, tz, 'd MMMM yyyy');
}

export function dateToYmd(date: Date, tz: string = DEFAULT_TZ): string {
  return format(toZonedTime(date, tz), 'yyyy-MM-dd');
}

export function timezoneLabel(tz: string): string {
  return tz === DEFAULT_TZ ? 'МСК' : tz;
}