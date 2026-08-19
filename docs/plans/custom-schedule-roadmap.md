# План: Кастомное расписание

## Текущее состояние

Сейчас расписание захардкожено на уровне backend:
- Рабочие часы: 06:00–22:00 МСК, единое окно на каждый день
- Сетка: 30-минутные слоты, 32 слота на день (06:00–21:30)
- Окно: 14 дней вперёд от текущей даты МСК
- Выходные/праздники: нет различия с буднями, все дни одинаковы
- Конфигурация задана константами в `booking/timeutils.py`

**Цель**: дать владельцу возможность настроить гибкое расписание доступности — по дням недели, с несколькими интервалами в день, перерывами, исключениями на конкретные даты и праздниками.

---

## Архитектурные решения

| Решение | Выбор | Обоснование |
|---------|-------|-------------|
| Уровень расписания | Владелец (owner) | Одно расписание на все event-type. Проще для v1. |
| Формат интервалов | Мульти-интервалы | Несколько окон в день (напр. 09:00–12:00, 14:00–18:00). |
| Сезонные расписания | Не в v1 | Исключения + праздники покрывают большинство случаев. |
| Хранилище | In-memory (текущий подход) | Без БД, как и весь проект в v1. |

---

## Модель данных

### 1. WeeklySchedule — недельное расписание

```python
@dataclass(frozen=True)
class TimeWindow:
    start: time  # начало интервала (МСК)
    end: time    # конец интервала (МСК), исключительно

@dataclass(frozen=True)
class DaySchedule:
    intervals: tuple[TimeWindow, ...]  # интервалы доступности для дня

@dataclass(frozen=True)
class WeeklySchedule:
    days: tuple[DaySchedule, ...]  # ровно 7 элементов, Пн=0..Вс=6
```

### 2. ScheduleException — исключение на конкретную дату

```python
@dataclass(frozen=True)
class ScheduleException:
    date: date
    intervals: tuple[TimeWindow, ...] | None
    # None = день полностью недоступен (праздник/отпуск)
    # Непустой кортеж = заменяет недельное расписание на эту дату
```

### 3. Владелец (расширение Owner)

```python
@dataclass(frozen=True)
class Owner:
    id: int
    name: str
    timezone: str
    weekly_schedule: WeeklySchedule           # NEW
    exceptions: tuple[ScheduleException, ...]  # NEW
```

---

## Изменение пайплайна генерации слотов

**Текущий**: хардкод 06:00–22:00 → 32 слота

**Новый**:
1. Определение интервалов для целевой даты:
   - Сначала проверить exceptions → если есть для этой даты, использовать его интервалы
   - Иначе → взять интервалы из weekly_schedule по дню недели
2. Разбиение каждого интервала на 30-минутные слоты
3. Пометка каждого слота free/busy

**Ключевые изменения в `booking/timeutils.py`**:
- Функция `grid_for_date_msk(d)` заменяется на `grid_for_date_msk(d, intervals)`
- Новая функция: `resolve_intervals(date, weekly_schedule, exceptions)`
- Константы `WORK_START`, `WORK_END`, `SLOTS_PER_DAY` убираются
- `GRID_MINUTES = 30` остаётся

---

## Декомпозиция по этапам

### Этап 1: TypeSpec API-контракт

**Задачи**:

1. **Отредактировать `spec/api.tsp`** — добавить модели расписания и owner-эндпоинты:
   - Новые модели: `TimeWindow`, `DaySchedule`, `WeeklySchedule`, `ScheduleException`, `OwnerSchedule`
   - Расширить информацию о владельце (или создать `OwnerProfile`) — добавить `schedule: OwnerSchedule`
   - Новые owner-эндпоинты:
     - `GET /api/owner/schedule` → `OwnerSchedule`
     - `PUT /api/owner/schedule` → `OwnerSchedule`
     - `POST /api/owner/schedule/exceptions` → `ScheduleException`
     - `DELETE /api/owner/schedule/exceptions/{date}` → 204
   - Валидация в TypeSpec:
     - `start` и `end` в формате `HH:mm`
     - `start < end`
     - Интервалы в одном дне не пересекаются
     - Кратность 30-минутной сетки (start/end на границе :00 или :30)
     - Максимум 4 интервала на день
     - Дата исключения — `YYYY-MM-DD`

2. **Скомпилировать контракт**:
   - `cd spec && npm run compile` → обновить `spec/generated/openapi.yaml`

**Файлы**:
- `spec/api.tsp` — изменения
- `spec/generated/openapi.yaml` — перегенерация

---

### Этап 2: Domain + TimeUtils (бэкенд)

**Задачи**:

1. **Добавить domain-модели** (`booking/domain.py`):
   - `TimeWindow(start: time, end: time)`
   - `DaySchedule(intervals: tuple[TimeWindow, ...])`
   - `WeeklySchedule(days: tuple[DaySchedule, ...])`
   - `ScheduleException(date: date, intervals: tuple[TimeWindow, ...] | None)`
   - Расширить `Owner` полями `weekly_schedule` и `exceptions`

2. **Рефакторинг timeutils** (`booking/timeutils.py`):
   - Добавить `resolve_intervals(target_date, weekly_schedule, exceptions) -> list[TimeWindow]`
   - Изменить `grid_for_date_msk(d, intervals)` — принимает интервалы вместо хардкода
   - Убрать глобальные константы `WORK_START`, `WORK_END`, `SLOTS_PER_DAY`
   - Добавить валидацию: `start < end`, интервалы не пересекаются, шаг кратен 30 мин

3. **Обновить seed** (`booking/seed.py`):
   - Дефолтное расписание: Пн–Пт 06:00–22:00 (как сейчас), Сб–Вс выходные
   - Нет исключений по умолчанию

4. **Тесты** (`booking/tests/`):
   - Тест `resolve_intervals`: недельное расписание, приоритет исключений, праздники
   - Тест `grid_for_date_msk` с кастомными интервалами
   - Тест мульти-интервалов (разрыв в середине дня)
   - Граничные случаи: интервал < 30 мин, интервалы вплотную, пустой день

**Файлы**:
- `booking/domain.py` — изменения
- `booking/timeutils.py` — рефакторинг
- `booking/seed.py` — обновление дефолтов
- `booking/tests/test_timeutils_schedule.py` — новый файл

---

### Этап 3: Slot + Booking Service (бэкенд)

**Задачи**:

1. **Обновить `SlotService.grid_for_day()`** (`booking/services/slots.py`):
   - Загружать расписание из `Owner` через `OwnerRepo`
   - Вызывать `resolve_intervals()` для целевой даты
   - Передавать интервалы в `grid_for_date_msk()`
   - Возвращать пустой список `[]` для праздников/нерабочих дней

2. **Обновить `BookingService.create()`** (`booking/services/bookings.py`):
   - Заменить проверку `is_within_work_hours_msk()` на проверку расписания
   - Новая функция-валидатор: `is_within_schedule(start_at, owner)` — проверяет попадание в интервалы
   - ErrorCode `slot_outside_hours` переиспользовать (или новый `slot_outside_schedule`)

3. **Тесты**:
   - Слоты только в пределах настроенных интервалов
   - Разные интервалы по дням недели
   - Исключение меняет расписание на конкретную дату
   - Праздник = пустой список слотов
   - Бронирование вне расписания → 422
   - Атомарное бронирование сохраняется

**Файлы**:
- `booking/services/slots.py` — изменения
- `booking/services/bookings.py` — изменения
- `booking/tests/test_slot_grid.py` — обновление
- `booking/tests/test_booking_conflict.py` — обновление
- `booking/tests/test_window_hours_past.py` — обновление

---

### Этап 4: Owner API — роутеры и схемы (бэкенд)

**Задачи**:

1. **Pydantic v2 схемы** (`booking/api/owner/schemas.py`):
   - `TimeWindowSchema`, `DayScheduleSchema`, `WeeklyScheduleSchema`
   - `ScheduleExceptionSchema`, `OwnerScheduleSchema`
   - Схемы валидации входных данных

2. **Новые owner-эндпоинты** (`booking/api/owner/router.py`):
   - `GET /api/owner/schedule` — текущее расписание владельца
   - `PUT /api/owner/schedule` — обновление недельного расписания
   - `POST /api/owner/schedule/exceptions` — добавить исключение
   - `DELETE /api/owner/schedule/exceptions/{date}` — удалить исключение

3. **Валидация**:
   - `start < end` в каждом интервале
   - Интервалы в одном дне не пересекаются
   - Кратность 30-минутной сетки
   - Максимум 4 интервала на день (защита от злоупотреблений)

4. **Перегенерация TS-типов фронта**:
   - `cd frontend && npm run gen:api`

5. **Тесты**:
   - CRUD расписания через API (интеграционные)
   - Валидация: пересекающиеся интервалы, невалидный формат, пустое расписание
   - Исключения: добавление, удаление, дубликат

**Файлы**:
- `booking/api/owner/schemas.py` — новые схемы
- `booking/api/owner/router.py` — новые эндпоинты
- `booking/tests/test_owner_schedule.py` — новый файл

---

### Этап 5: Frontend — Admin UI (управление расписанием)

**Задачи**:

1. **Новые shadcn/ui компоненты** (через shadcn MCP):
   - TimePicker или нативный input[type=time]

2. **Новая feature: admin-schedule** (`frontend/src/features/admin-schedule/`):
   - `WeeklyScheduleEditor.tsx` — интерактивный редактор недельного расписания
     - Список дней недели (Пн–Вс), каждый с toggle вкл/выкл
     - Для включённого дня: список интервалов (start, end) + кнопка «Добавить интервал»
     - Клиентская валидация: start < end, нет пересечений, кратность 30 мин
   - `ExceptionList.tsx` — список исключений
     - Таблица: дата, интервалы (или «Выходной»), кнопка удалить
     - Кнопка «Добавить исключение» → модалка с date-picker + time-интервалами
   - `useOwnerSchedule.ts` — TanStack Query hook для GET /api/owner/schedule
   - `useUpdateSchedule.ts` — мутация для PUT /api/owner/schedule
   - `useAddException.ts` — мутация для POST /api/owner/schedule/exceptions
   - `useDeleteException.ts` — мутация для DELETE /api/owner/schedule/exceptions/{date}

3. **Новая страница** (`frontend/src/pages/admin/AdminSchedulePage.tsx`):
   - Роут: `/admin/schedule`
   - Содержит `WeeklyScheduleEditor` + `ExceptionList`
   - Кнопка «Сохранить» для обновления недельного расписания
   - Toast об успехе/ошибке

4. **Навигация** (`frontend/src/components/layout/AppHeader.tsx`):
   - Добавить ссылку «Расписание» в admin-навигацию

5. **Роутинг** (`frontend/src/app/providers.tsx`):
   - Добавить маршрут `/admin/schedule` → `AdminSchedulePage`

6. **Сообщения об ошибках** (`frontend/src/api/errors.ts`):
   - Добавить маппинг для ErrorCode, связанных с расписанием

**Файлы**:
- `frontend/src/features/admin-schedule/` — новый каталог
- `frontend/src/pages/admin/AdminSchedulePage.tsx` — новый
- `frontend/src/components/layout/AppHeader.tsx` — изменения
- `frontend/src/app/providers.tsx` — изменения
- `frontend/src/features/admin-schedule/WeeklyScheduleEditor.tsx` — новый
- `frontend/src/features/admin-schedule/ExceptionList.tsx` — новый
- `frontend/src/features/admin-schedule/useOwnerSchedule.ts` — новый
- `frontend/src/features/admin-schedule/useUpdateSchedule.ts` — новый
- `frontend/src/features/admin-schedule/useAddException.ts` — новый
- `frontend/src/features/admin-schedule/useDeleteException.ts` — новый

---

### Этап 6: Frontend — Public UI (отображение)

**Задачи**:

1. **Обновить Calendar14** (`frontend/src/features/public-slot-picker/Calendar14.tsx`):
   - Дни с пустым расписанием (выходные/праздники) визуально отличать (затемнённые, без возможности выбора)
   - Опционально: бейдж «Нет слотов» на дне календаря

2. **Обновить SlotGrid** (`frontend/src/features/public-slot-picker/SlotGrid.tsx`):
   - Если слотов нет (праздник) — показать сообщение: «В этот день запись невозможна»
   - Группировка слотов по интервалам (визуальное разделение перерыва)

3. **Тесты**:
   - E2E: календарь отображает нерабочие дни корректно
   - E2E: пустое состояние SlotGrid для выходных

**Файлы**:
- `frontend/src/features/public-slot-picker/Calendar14.tsx` — изменения
- `frontend/src/features/public-slot-picker/SlotGrid.tsx` — изменения

---

### Этап 7: Интеграция и финализация

**Задачи**:

1. **Полный прогон проверок**:
   - `cd spec && npm run compile`
   - `cd frontend && npm run gen:api && npm run lint && npm run typecheck && npm run test:unit && npm run build`
   - `cd backend && poetry run ruff check . && poetry run pytest`
   - `cd frontend && npm run test:e2e`

2. **Обновить документацию**:
   - `AGENTS.md` — описание новых эндпоинтов и архитектурных изменений
   - DevLog в `docs/devlog/`

---

## Порядок выполнения

```
Этап 1 (TypeSpec контракт)  →  Этап 2 (Domain + TimeUtils)
                                         │
                                         v
                                Этап 3 (Slot/Booking Service)
                                         │
                                         v
                                Этап 4 (Owner API роутеры)
                                         │
                                         v
                                Этап 5 (Frontend Admin UI)
                                         │
                                         v
                                Этап 6 (Frontend Public UI)
                                         │
                                         v
                                Этап 7 (Интеграция + Тесты)
```

Этап 1: контракт-первый подход — сначала API, потом реализация.
Этапы 2–4: бэкенд (domain → services → API-слои).
Этапы 5–6: фронтенд (admin → public).
Этап 7: интеграция и валидация.

---

## Оценка объёма

| Этап | Сложность | Файлов (≈) | Комментарии |
|------|-----------|-------------|-------------|
| 1. TypeSpec контракт | Низкая | 2 | Модели + эндпоинты + компиляция |
| 2. Domain + TimeUtils | Средняя | 4 | Чистые модели, рефакторинг timeutils |
| 3. Slot/Booking Service | Средняя | 5 | Замена хардкода на расписание |
| 4. Owner API роутеры | Средняя | 3 | Pydantic-схемы + эндпоинты |
| 5. Frontend Admin UI | Высокая | 8+ | Новая feature с формами и мутациями |
| 6. Frontend Public UI | Низкая | 2 | Минимальные изменения в UI |
| 7. Интеграция | Средняя | 2–3 | Прогоны, документация |

---

## Риски и митигации

| Риск | Митигация |
|------|-----------|
| Нарушение обратной совместимости API | Только новые эндпоинты, старые не меняются. Дефолтное расписание = текущий хардкод. |
| Сложность UI-редактора расписания | Итеративно: сначала простой список, потом валидация и UX-улучшения. |
| Конфликты при параллельной разработке | Этапы чётко разделены, мерж по порядку. |
| In-memory хранилище не масштабируется | Для v1 ОК; при переходе на БД — миграция моделей тривиальна. |
