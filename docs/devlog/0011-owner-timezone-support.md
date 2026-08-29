# Поддержка разных таймзон: business-правила и UI привязаны к Owner.timezone

## 🎯 Проблема
Весь код жёстко привязан к `Europe/Moscow`: бизнес-правила (окно 14 дней,
рабочие часы 06:00–22:00, сетка 30 мин), UI-форматирование и лейблы «МСК».
Пользователи из других таймзон видели сетку/время в чужом для себя часовом поясе.
У модели `Owner` уже было поле `timezone` (по умолчанию `Europe/Moscow`), но ни один
сервис его не читал — мёртвое поле.

## ✅ Решение
Все правила и форматирование теперь параметризуются таймзоной владельца.

**Backend**
- `booking/timeutils.py`: функции `today_msk/window_dates_msk/combine_msk_to_utc/
  is_within_work_hours_msk/grid_for_date_msk` переименованы и параметризованы
  аргументом `tz: ZoneInfo` (`today_in_tz/window_dates/combine_to_utc/
  is_within_work_hours/grid_for_date`). `MSK` остался как константа-дефолт.
- `SlotService` и `BookingService` принимают `tz` в конструкторе; `deps.py`
  резолвит `ZoneInfo(app_registry.owner.timezone)` на каждый запрос.
- `EventTypeOut` (public и owner router) получил поле `timezone` — через него
  фронтенд узнаёт локальный пояс владельца (есть в списке, по id и в
  `BookingConfirmation.event_type`).
- `AppRegistry.set_owner_timezone()` — публичный сеттер для тестов.

**Wire-контракт (`spec/api.tsp`)**
- В `EventType` добавлено поле `timezone: string` (IANA). UTC ISO 8601 на wire
  не меняется — таймзона влияет только на генерацию сетки и отображение.

**Frontend**
- `src/api/time.ts`: `MSK` → параметризуемые `todayInTz/addDays/formatSlotRange/
  formatAdminBookingTime/...` + дефолт `DEFAULT_TZ` и `formatTzName()` для лейблов.
- `src/lib/formatters.ts`: `Intl.DateTimeFormat` с `timeZone: tz`, новый
  `formatDateYmd()` для дат из календарной строки (без конвертации инстант).
- `Calendar14`, `SlotGrid`, `EventTypeSlotsPage`, `BookingFormPage`,
  `BookingSuccessPage` — берут таймзону из `EventType.timezone` (prop/API).
- Админка (`AdminBookingsPage`/`UpcomingBookingsTable`) получает пояса из
  `GET /api/owner/event-types`, лейбл колонки «Дата и время (Moscow)».
- Лейблы «МСК» заменены на компактное имя пояса.

## 📝 Изменённые файлы
- Backend: `timeutils.py`, `services/slots.py`, `services/bookings.py`,
  `api/deps.py`, `api/public|owner/{router,schemas}.py`, `app_registry.py`,
  новый `tests/test_timezones.py` (JST-кейсы: сетка, рабочие часы, окно, поле timezone).
- Spec: `api.tsp` + перегенерированный `spec/generated/openapi.yaml`.
- Frontend: `api/time.ts`, `lib/formatters.ts`, слот-пикер/календарь, страницы
  бронирования и успеха, админ-таблица; unit-тесты `time-tz.spec.ts` и `slots.spec.ts`.

## 🚀 Как протестировать
1. Backend: `cd backend && poetry run pytest` — 31+ тест, новые JST-тесты.
2. Frontend: `cd frontend && npm run gen:api && npm run lint && npm run typecheck
   && npm run test:unit && npm run build && npm run test:e2e`.
3. Сменить `Owner.timezone` на `Asia/Tokyo` в `seed.py` → сетка и рабочие часы
   перестраиваются на JST, фронт показывает «Tokyo» вместо «МСК».

## ⚙️ Важные детали
- Хранилище in-memory, миграций нет — изменилась только логика.
- Поведение по умолчанию не изменилось: сид создаёт владельца с
  `timezone="Europe/Moscow"`, все «мсковские» тесты проходят без правок.
- Окно 14 дней и сетка 30 мин привязаны к локальному поясу владельца;
  `is_within_work_hours` и `window_dates` используют переданный `tz`.