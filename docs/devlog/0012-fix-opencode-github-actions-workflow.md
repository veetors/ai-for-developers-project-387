# Исправление GitHub Actions workflow opencode: git-идентичность и права на PR

## 🎯 Проблема
workflow `opencode` (`.github/workflows/opencode.yml`), триггеримый комментарием
`/oc`/`/opencode` в issue/PR, падал в CI:

- `Author identity unknown` / `fatal: empty ident name` — opencode не мог сделать
  commit (для создания ветки и PR).
- После починки идентичности джоба «зависала» без результата.
- Следующий запуск падал с `GitHub Actions is not permitted to create or approve
  pull requests`.

## ✅ Решение
Причина — три отдельных дефекта, починены:

**1. Git-идентичность в режиме `use_github_token: true`**
В этом режиме opencode намеренно пропускает `configureGit()` (настройку
`user.name`/`user.email` и push-авторизации), поэтому нужно настраивать
идентичность самому в workflow:
```yaml
- name: Configure git identity
  run: |
    git config user.name "opencode-agent[bot]"
    git config user.email "opencode-agent[bot]@users.noreply.github.com"
```
Идентичность задана локально для репозитория (без `--global`).

**2. Права workflow**
- `permissions.contents`: `read` → `write` (нужно для push ветки и PR).
- Оставлен полный набор: `id-token: write`, `contents: write`,
  `pull-requests: write`, `issues: write`.

**3. Credentials для push**
`actions/checkout` переведён с `persist-credentials: false` на `true`, чтобы
git push имел доступ к `GITHUB_TOKEN`.

**4. Server-side политика GitHub (вручную)**
В репозитории Settings → Actions → General включена опция **«Allow GitHub Actions
to create and approve pull requests»** — именно она финально разрешила создание PR.
Настройка «Workflow permissions» оставлена на «Read repository contents» — нужные
права выдаются точечно через блок `permissions:` в самом workflow.

## 📝 Изменённые файлы
1. `.github/workflows/opencode.yml` - `contents: write`, `persist-credentials: true`,
   добавлен шаг `Configure git identity`, сохранён `id-token: write`.
2. Настройка GitHub-репозитория (не файл): включена опция создания/одобрения PR
   через Actions.

## 🚀 Как протестировать
1. Оставить комментарий `/oc` (или `/opencode`) в любом issue/PR — триггернётся
   свежий run `opencode` на актуальном `main`.
2. Проверить, что джоба проходит: opencode коммитит, пушит ветку и открывает PR.
3. Локальная регрессия (на случай затронутого кода):
   `cd backend && poetry run pytest && poetry run ruff check .`
   `cd frontend && npm run gen:api && npm run lint && npm run typecheck
   && npm run test:unit && npm run build && npm run test:e2e`.

## ⚙️ Важные детали
- `use_github_token: true` экономит OIDC-обмен и не требует установки GitHub App
  opencode, но перекладывает настройку git-идентичности на workflow.
- Блок `permissions:` в джобе переопределяет глобальную настройку
  «Workflow permissions» репозитория, поэтому глобальную менять на
  «Read and write» не требуется (и не рекомендуется — это шире, чем нужно).
- После фикса opencode успешно создал PR `#5` (ветка `opencode/issue2-...`),
  который был влит; все CI-джобы и локальные тесты зелёные.

## 🎉 Итог
workflow `opencode` снова работает: агент коммитит изменения, пушит ветку и открывает
PR по запросу `/oc`, CI-круг (Spec / Frontend / Backend / E2E) проходит.
