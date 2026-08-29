import { useMemo } from 'react';
import { addDays, todayInTz } from '@/api/time';
import { Calendar } from '@/components/ui/calendar';

interface Calendar14Props {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  tz: string;
}

export function Calendar14({ value, onChange, tz }: Calendar14Props) {
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