import { useMemo } from 'react';
import { addDays, todayInTz, DEFAULT_TZ } from '@/api/time';
import { Calendar } from '@/components/ui/calendar';

interface Calendar14Props {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  timezone?: string;
}

export function Calendar14({ value, onChange, timezone }: Calendar14Props) {
  const tz = timezone ?? DEFAULT_TZ;
  const { from, to } = useMemo(() => {
    const fromDate = todayInTz(tz);
    const toDate = addDays(fromDate, 13, tz);
    return { from: new Date(`${fromDate}T00:00:00`), to: new Date(`${toDate}T00:00:00`) };
  }, [tz]);

  return (
    <Calendar
      mode="single"
      selected={value}
      onSelect={onChange}
      disabled={{ before: from, after: to }}
      fromDate={from}
      toDate={to}
      defaultMonth={value ?? from}
    />
  );
}
