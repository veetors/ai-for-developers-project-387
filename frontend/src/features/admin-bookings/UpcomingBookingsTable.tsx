import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAdminBookingTime } from '@/lib/formatters';
import { formatTzName, DEFAULT_TZ } from '@/api/time';
import type { AdminBooking } from '@/api/types';

interface UpcomingBookingsTableProps {
  bookings: AdminBooking[];
  timezone?: string;
}

export function UpcomingBookingsTable({ bookings, timezone }: UpcomingBookingsTableProps) {
  const tz = timezone ?? DEFAULT_TZ;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата и время ({formatTzName(tz)})</TableHead>
          <TableHead>Тип события</TableHead>
          <TableHead>Гость</TableHead>
          <TableHead>E-mail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow key={booking.id} data-booking-id={booking.id}>
            <TableCell>{formatAdminBookingTime(booking.start_at, tz)}</TableCell>
            <TableCell>{booking.event_type_name}</TableCell>
            <TableCell>{booking.guest_name}</TableCell>
            <TableCell>{booking.guest_email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
