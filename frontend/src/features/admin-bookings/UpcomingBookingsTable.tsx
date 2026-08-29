import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatAdminBookingTime } from '@/lib/formatters';
import { DEFAULT_TZ, timezoneLabel } from '@/api/time';
import type { AdminBooking } from '@/api/types';

interface UpcomingBookingsTableProps {
  bookings: AdminBooking[];
}

export function UpcomingBookingsTable({ bookings }: UpcomingBookingsTableProps) {
  const tz = bookings[0]?.timezone ?? DEFAULT_TZ;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата и время ({timezoneLabel(tz)})</TableHead>
          <TableHead>Тип события</TableHead>
          <TableHead>Гость</TableHead>
          <TableHead>E-mail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bookings.map((booking) => (
          <TableRow key={booking.id} data-booking-id={booking.id}>
            <TableCell>
              {formatAdminBookingTime(booking.start_at, booking.timezone ?? tz)}
            </TableCell>
            <TableCell>{booking.event_type_name}</TableCell>
            <TableCell>{booking.guest_name}</TableCell>
            <TableCell>{booking.guest_email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}