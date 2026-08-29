import { test, expect, type APIRequestContext } from '@playwright/test'
import { addDays } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

const DEFAULT_TZ = 'Europe/Moscow'

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

function isoLocalTomorrowAt(hh: number, mm: number, tz: string): string {
  const tomorrow = addDays(new Date(), 1)
  const date = formatInTimeZone(tomorrow, tz, 'yyyy-MM-dd')
  const offset = formatInTimeZone(tomorrow, tz, 'xxx')
  return `${date}T${pad(hh)}:${pad(mm)}:00${offset}`
}

async function seedEventTypeAndBooking(
  request: APIRequestContext,
  suffix: string,
): Promise<{ eventTypeName: string; guestName: string }> {
  const eventTypeName = `US-O1 ${suffix}`
  const etRes = await request.post('/api/owner/event-types', {
    data: {
      name: eventTypeName,
      description: 'acceptance: US-O1',
      duration_minutes: 30,
    },
  })
  expect(etRes.status()).toBe(200)
  const et = (await etRes.json()) as { id: number }

  const tzRes = await request.get(`/api/event-types/${et.id}`)
  expect(tzRes.status()).toBe(200)
  const tzBody = (await tzRes.json()) as { timezone?: string }
  const tz = tzBody.timezone ?? DEFAULT_TZ

  const guestName = `US-O1 guest ${suffix}`
  const booking = await request.post(`/api/event-types/${et.id}/bookings`, {
    data: {
      guest_name: guestName,
      guest_email: 'o1@example.com',
      start_at: isoLocalTomorrowAt(11, 0, tz),
    },
  })
  expect(booking.status()).toBe(200)

  return { eventTypeName, guestName }
}

test('US-O1: admin bookings list renders upcoming booking with owner-tz time', async ({
  page,
  request,
}) => {
  const seed = await seedEventTypeAndBooking(request, uniqueSuffix())

  await page.goto('/admin/bookings')
  const row = page.locator('tr', { hasText: seed.guestName })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row).toContainText(seed.eventTypeName)
  await expect(row).toContainText('o1@example.com')
  // formatAdminBookingTime outputs "d MMMM yyyy 'г.,' HH:mm" — Chromium
  // (default en-US) renders the month name in English, e.g. "17 August 2026 г., 11:00".
  await expect(row).toContainText(/\d{1,2}\s+[A-Za-zА-Яа-я]+\s+\d{4}\s*г\.,?\s*\d{1,2}:\d{2}/)
})