# Регулярная Lighthouse-проверка через opencode-агента по расписанию

## 🎯 Проблема
У проекта есть CI на функциональность (lint, typecheck, юнит, e2e), но нет
регулярного измерения качества и производительности фронтенда. Качество могло
тихо деградировать с каждым коммитом, а команда не имела «понятного результата»
для принятия решений о правках.

## ✅ Решение
Добавлена повторяющаяся задача `.github/workflows/opencode-scheduled.yml` в стиле
[Schedule Example из opencode docs](https://opencode.ai/docs/github/#schedule-example):
агент **opencode** по расписанию (и вручную через `workflow_dispatch`) выполняет
полный прогон Lighthouse CI:

1. Поднимает продакшен-стек `docker compose --profile default` (nginx :3000 → Django + postgres);
2. Сидит демо-тип события через owner API (чтобы каталог и сетка слотов имели контент);
3. Запускает `npx lhci autorun` c конфигом `frontend/lighthouserc.cjs` (3 URL × 3 прогона);
4. Анализирует отчёты в `.lighthouseci/` (скоры, проваленные аудиты, регрессии);
5. Дописывает датированную запись в этот файл; при регрессиях/дефектах открывает PR;
6. HTML-отчёты сохраняются как artifact `lighthouse-reports` (30 дней), таблица скоров — в job summary.

Расписание — daily 04:17 МСК (`17 1 * * *`, 01:17 UTC): off-peak час + нечётная минута
против дропов планировщика GitHub (см. docs/devlog/0014-schedule-delivery.md).

Assertions в `lighthouserc.cjs` пока на уровне `warn` (джоба зелёная, но предупреждения видны);
пороги ужесточать до `error`, когда накопятся данные.

## 📝 Изменённые файлы
1. `.github/workflows/opencode-scheduled.yml` — новая повторяющаяся задача: `schedule` + `workflow_dispatch`, агент opencode с `prompt`, upload artifacts, summary, cleanup стека, concurrency-группа.
2. `frontend/lighthouserc.cjs` — конфиг LHCI: URL, 3 прогона, `--no-sandbox`, warn-ассершены, upload в `temporary-public-storage`.
3. `frontend/package.json` / `package-lock.json` — добавлен devDependency `@lhci/cli@^0.15.1`.
4. `frontend/scripts/lhci-summary.mjs` — таблица скоров по URL (медиана по LHR JSON) в `$GITHUB_STEP_SUMMARY`.
5. `frontend/.gitignore` — добавлен `.lighthouseci/`.
6. `README.md` — раздел о регулярной проверке.

## 🚀 Как протестировать
1. Ручной запуск: Actions → **Scheduled OpenCode Task (Lighthouse)** → Run workflow.
2. Отчёт: вкладка прогона → job summary (таблица) + артефакт `lighthouse-reports` (HTML) + публичные ссылки из лога.
3. Локально: поднять стек (`docker compose --profile default up -d --build --wait backend frontend db`),
   сидить тип события, затем `cd frontend && npx lhci autorun`, смотреть `.lighthouseci/`.

## ⚙️ Важные детали
- `LHCI_GITHUB_TOKEN` = `secrets.GITHUB_TOKEN` (статус-чек в будущих PR);
- `concurrency.cancel-in-progress: false` — daily прогоны не накладываются;
- `.lighthouseci/` в `.gitignore` — изменения агента коммитятся только через devlog/PR;
- summary считается из самих LHR JSON (при `temporary-public-storage` файла `manifest.json` не создаётся).

## 📊 Базовый прогон (2026-08-29)
Стек: локальный `docker compose --profile default`, 3 URL × 3 прогона, десктопный Lighthouse.

| Страница | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 81 | 95 | 100 | 82 |
| `/event-types` | 80 | 100 | 100 | 82 |
| `/event-types/1` | 79 | 96 | 100 | 82 |

Публичные отчёты: `/` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788002010004-33007.report.html>,
`/event-types` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788002011004-94976.report.html>,
`/event-types/1` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788002012122-3959.report.html>.

### По итогам отчёта — правки, которые нужны в проекте
1. **Включить сжатие статики (gzip/brotli)** — nginx отдаёт JS/CSS без `content-encoding` (547 КБ JS «как есть»): аудит `uses-text-compression`, 389 КБ экономии. Файлы: `frontend/nginx.conf`, `nginx.conf.template`. Добавить `gzip on; gzip_types ...` (или модуль brotli).
2. **Код-сплиттинг по маршрутам** — единый бандл `index-*.js` 545 КБ, на главной 64% кода не используется (`unused-javascript`, экономия 344 КБ; LCP-задержка 88% — рендер блокируется большим JS). Файл: `frontend/src/app/providers.tsx` — перевести страницы на `React.lazy`/маршрутный `splitPoints`. Vite уже предупреждает про chunk > 500 КБ.
3. **`<meta name="description">`** — отсутствует (`meta-description`, SEO 82). Файл: `frontend/index.html`.
4. **`/robots.txt`** — отсутствует, отдаётся SPA index.html (`robots-txt`). Добавить `frontend/public/robots.txt`.
5. **Контраст кнопки «Записаться»** — белый текст на оранжевом (2.85:1 < 4.5:1) (`color-contrast`). Файл: `frontend/src/styles/globals.css:22` — затемнить `--primary` (сейчас `24 95% 53%`).

## 🎉 Итог
В проекте работает регулярная Lighthouse-проверка с отчётом: команда видит таблицу
скоров и публичные HTML-отчёты в Actions, а агент фиксирует, какие правки нужны.
Базовый прогон: 79–81 Performance, 95–100 Accessibility, 100 Best Practices, 82 SEO —
главные точки роста: сжатие статики, код-сплиттинг, meta/robots, контраст.

## 📊 Прогон 2026-08-29 (повторный, с фиксами)

- Дата ISO: `2026-08-29`
- Ветка: `lighthouse/2026-08-29` (PR в `main`); фиксы: commit `cc1850e`
- Стек: тот же `docker compose --profile default` (nginx :3000 → Django → postgres),
  3 URL × 3 прогона, десктопный Lighthouse, assertions — все зелёные.

Стартовый (без фиксов) прогон дал регрессию: `/event-types/1` Performance 79 → 76
(ФСР/LCP 3.6 с / 4.0–4.3 с, прежние дефекты контраста/meta/robots на месте).
Применены безопасные минимальные фиксы (`cc1850e`), повторный прогон:

| Страница | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 98 | 100 | 100 | 100 |
| `/event-types` | 98 | 100 | 100 | 100 |
| `/event-types/1` | 95 | 100 | 100 | 100 |

Ключевые метрики (медиана): FCP 1.8 с, LCP 2.0–2.5 с, TBT 10–150 мс; регрессия на
`/event-types/1` устранена (76 → 95).

Публичные отчёты: `/` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788003342179-52896.report.html>,
`/event-types` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788003342622-35560.report.html>,
`/event-types/1` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788003343139-6875.report.html>.

### Топ-10 проблем и как исправить
1. **Единый бандл ~545 КБ** (`unused-javascript`, Vite: «chunk > 500 kB») — экономия 99–123 КБ. Как исправить: код-сплиттинг по маршрутам (`React.lazy`) в `frontend/src/app/providers.tsx`, либо `manualChunks` в `frontend/vite.config.ts`.
2. **Render-blocking CSS `index-*.css`** — 150 мс на всех страницах. Как исправить: инлайн критического CSS или `preload`/`fetchpriority` ссылки в `frontend/index.html`.
3. **TBT 150 мс на `/event-types/1`** (рендер календаря). Как исправить: `React.memo` для календаря/слотов в `frontend/src/components/ui/calendar.tsx` и `frontend/src/features/public-slot-picker/SlotGrid.tsx`.
4. **LCP 2.5 с на `/event-types/1`** — та же причина, что #1/#3 (лишний рендер и JS на маршруте слотов). Как исправить: код-сплиттинг страницы в `frontend/src/app/providers.tsx`.
5. **`max-potential-fid` / long-task на `/event-types/1`** — долгая задача на старте. Как исправить: отложить non-critical JS (`defer`) и уменьшить bundle (см. #1).
6. **`color-contrast`** — ИСПРАВЛЕНО: `--primary` затемнён до `24 95% 38%`, контраст 2.85:1 → **4.93:1** (было `frontend/src/styles/globals.css:22`).
7. **`meta-description`** — ИСПРАВЛЕНО: добавлено в `frontend/index.html` (SEO 82 → 100).
8. **`robots.txt`** — ИСПРАВЛЕНО: добавлен `frontend/public/robots.txt`.
9. **`uses-text-compression`** — ИСПРАВЛЕНО: gzip включён в `frontend/nginx.conf` и `nginx.conf.template` (Perf 76–81 → 95–98).
10. **`npm audit` при сборке frontend-образа** — 17 vulns (2 low, 6 moderate, 8 high, 1 critical) в devDeps. Как исправить: `npm audit fix` в `frontend/` (не затрагивает Lighthouse, блокирует только при ужесточении политики).

Остаточные предупреждения (assertions на `warn`, джоба зелёная) — в основном перф
(/event-types/1 TBT/LCP): пороги ужесточать до `error` после код-сплиттинга.

## 📊 Прогон 2026-08-29 (регулярный, чистый)

- Дата ISO: `2026-08-29`
- Ветка/commit: `opencode/dispatch-d47831-20260829115617` / `2c6fbfb`
- Стек: тот же `docker compose --profile default` (nginx :3000 → Django → postgres),
  3 URL × 3 прогона, десктопный Lighthouse, assertions — все зелёные, регрессии нет.
- Демо-контент: создан тип события `Консультация 1:1` (id=1) через owner API.

| Страница | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 98 | 100 | 100 | 100 |
| `/event-types` | 98 | 100 | 100 | 100 |
| `/event-types/1` | 97 | 100 | 100 | 100 |

Ключевые метрики (медиана): FCP 1.8 с на всех страницах, LCP 2.0–2.4 с, TBT 0–70 мс,
CLS 0, TTFB ~0 мс. Сравнение с прошлым прогоном: `/` и `/event-types` без изменений
(98/98), `/event-types/1` Performance **95 → 97** (улучшение), остальные категории стабильны.
Регрессий нет, правок в этот прогон не требуется.

Публичные отчёты: `/` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788004764205-96423.report.html>,
`/event-types` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788004764532-89913.report.html>,
`/event-types/1` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788004764905-81040.report.html>.

### Топ-10 проблем и как исправить
1. **Единый бандл ~545 КБ** (`unused-javascript`, экономия 99–123 КБ) — код-сплиттинг по маршрутам (`React.lazy`) в `frontend/src/app/providers.tsx`, либо `manualChunks` в `frontend/vite.config.ts`.
2. **Render-blocking CSS `index-*.css`** — 150 мс на всех страницах. Как исправить: инлайн критического CSS или `preload`/`fetchpriority` в `frontend/index.html`.
3. **FCP 1.8 с на всех URL** — следствие #1/#2. Как исправить: те же меры (сжатие JS/CSS уже включено; убрать render-blocking и лишний JS).
4. **LCP 2.4 с на `/event-types/1`** — рендер сетки слотов. Как исправить: код-сплиттинг страницы слотов (см. #1).
5. **TBT 70 мс / `max-potential-fid` 120 мс на `/event-types/1`** — долгая задача при рендере календаря. Как исправить: `React.memo`/лязiness календаря в `frontend/src/components/ui/calendar.tsx` и `frontend/src/features/public-slot-picker/SlotGrid.tsx`.
6. **`interactive` (TTI) 2.4 с на `/event-types/1`** — та же причина, что #4/#5. Как исправить: уменьшить главный бандл (см. #1).
7. **Аудит `network-dependency-tree-insight`** (информационный, диагн. версия) — пересматривать после код-сплиттинга.
8. **Аудит `render-blocking-insight`** (информационный) — пересматривать после #2.
9. **`npm audit` при сборке frontend-образа** — 17 vulns (2 low, 6 moderate, 8 high, 1 critical) в devDeps. Как исправить: `npm audit fix` в `frontend/` (не влияет на Lighthouse, блокирует только при ужесточении политики).
10. **Статус-чек LHCI 403 в Actions** — `GITHUB_TOKEN` из workflow не имеет прав на `statuses` (загрузка отчётов в temporary-public-storage при этом работает). Как исправить: при необходимости статус-чека в PR — токен с `checks: write`/`statuses: write` (низкий приоритет).

Вывод: прогон чистый (базовая линия держится: 97–98 Perf / 100 остальные), регрессий нет,
PR не открывался; остаточные перф-предупреждения — только код-сплиттинг и render-blocking CSS.

## 📊 Прогон 2026-09-03 (регулярный, чистый)

- Дата ISO: `2026-09-03`
- Ветка/commit: `opencode/schedule-fd8e17-20260903054735` / `e53cb59`
- Стек: тот же `docker compose --profile default` (nginx :3000 → Django → postgres),
  3 URL × 3 прогона, десктопный Lighthouse, assertions — все зелёные (0 warning).
- Демо-контент: создан тип события `Консультация 1:1` (id=1) через owner API.

| Страница | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | 98 | 100 | 100 | 100 |
| `/event-types` | 98 | 100 | 100 | 100 |
| `/event-types/1` | 95 | 100 | 100 | 100 |

Ключевые метрики (медиана): FCP ~1.8 с на всех страницах, LCP 2.0–2.4 с,
TBT 18 мс (`/`) / 53 мс (`/event-types`) / 142 мс (`/event-types/1`), CLS 0.
Сравнение с прошлым прогоном: `/` и `/event-types` без изменений (98/98),
`/event-types/1` Performance **97 → 95** (небольшой шумовой спад: TBT 70→142 мс,
max-potential-fid ~170 мс при рендере календаря; те же остаточные причины — код-сплиттинг
и render-blocking CSS). Категории A11y/BP/SEO стабильны (100). Регрессии/новых дефектов
не вносилось — правки в этот прогон не требуются, PR не открывался.

Публичные отчёты: `/` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788414673596-77229.report.html>,
`/event-types` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788414673904-65281.report.html>,
`/event-types/1` — <https://storage.googleapis.com/lighthouse-infrastructure.appspot.com/reports/1788414674261-35138.report.html>.

### Топ-10 проблем и как исправить
1. **Единый бандл `index-*.js` 545 КБ** (`unused-javascript`, экономия 100–123 КБ) — код-сплиттинг по маршрутам (`React.lazy`) в `frontend/src/app/providers.tsx`, либо `manualChunks` в `frontend/vite.config.ts`.
2. **Render-blocking CSS `index-*.css`** — ~150 мс на всех страницах. Как исправить: инлайн критического CSS или `preload`/`fetchpriority` в `frontend/index.html`.
3. **TBT 142 мс / `max-potential-fid` ~170 мс на `/event-types/1`** — долгая задача при рендере календаря/сетки слотов. Как исправить: `React.memo`/лязiness в `frontend/src/components/ui/calendar.tsx` и `frontend/src/features/public-slot-picker/SlotGrid.tsx`.
4. **LCP 2.4 с на `/event-types/1`** — следствие #1/#3 (лишний JS на маршруте слотов). Как исправить: код-сплиттинг страницы (см. #1).
5. **TTI 2.4 с на `/event-types/1`** — та же причина. Как исправить: уменьшить главный бандл (см. #1).
6. **`network-dependency-tree-insight`** (информационный, диагн. версия) — пересматривать после код-сплиттинга.
7. **`render-blocking-insight`** (информационный) — пересматривать после #2.
8. **`npm audit` при сборке frontend-образа** — 20 vulns (2 low, 9 moderate, 8 high, 1 critical) в devDeps. Как исправить: `npm audit fix` в `frontend/` (не влияет на Lighthouse, блокирует только при ужесточении политики).
9. **Статус-чек LHCI 403 в Actions** — `GITHUB_TOKEN` workflow не имеет прав на `statuses` (загрузка во `temporary-public-storage` работает). Как исправить: для статус-чека — токен с `checks: write`/`statuses: write` (низкий приоритет).
10. **Небольшой шумовой спад `/event-types/1` Perf 97→95** — наблюдать следующий прогон; порог warn уже держится, реальной регрессии нет.

Вывод: прогон чистый (assertions 0 warning; базовая линия держится: 95–98 Perf / 100 остальные),
регрессий/новых дефектов нет, PR не открывался; остаточные перф-предупреждения — код-сплиттинг
и render-blocking CSS (плюс шумовой спад на странице слотов).