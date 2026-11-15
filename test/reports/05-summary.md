# 05. Сводка: все проблемы по важности, запуск тестов, проверка на секреты

- **Дата:** 15.11.2026
- **Окружение:** Windows 10.0.19045, Node.js v24.11.0, PostgreSQL 18, Vitest 5.1.0 + Supertest 7.3.2 (API),
  Playwright 1.65.1 + Chromium 159 (UI).
- **База:** копия `my_crypto_copy_test`. Рабочая `my_crypto` использовалась **только** для `pg_dump`
  при создании копии; сервер против неё не запускался.
- **Источники сводки:** `01-baseline.md`, `03-api.md`, `04-ui.md`, `06-fixes.md`, `07-copy-check.md`,
  `FIXES_FOR_AGENT.md`.
- **Область этапа:** менялись только файлы внутри `test/` (`reports/`, `scripts/`, `package.json`,
  `.gitignore`, фикстура в `api/02-auth-registration.test.js`). Вне `test/` ничего не изменено.

## Итоговые цифры

| Набор | Всего | Прошло | Упало | Что означают падения |
| --- | --- | --- | --- | --- |
| API (Vitest, `test/api/`) | **146** | 133 | **13** | 10 зафиксированных дефектов API (13 тестов) |
| UI (Playwright, `test/ui/`) | **44** | 41 | **3** | 3 зафиксированных дефекта UI |
| **Всего** | **190** | **174** | **16** | все 16 падений — намеренно красные дефект-тесты |

Ни один тест не отключён (`skip`/`todo`/`it.fails` нет), ожидания не ослаблены.

Свежий прогон одной командой (`cd test && npm run test:all`, сводка в
`test/tmp/05-run-all-summary.json`):

```text
API (Vitest):      133 passed / 13 failed / 146 всего (код выхода 1)
UI (Playwright):    41 passed /  3 failed /  44 всего (код выхода 1)
Всего:             174 passed / 16 failed / 190 тестов
```

Сохранность копии БД по итогам того же прогона: `03-api-summary.json` — `users 4 → 4`,
`favorites 7 → 7`, `preserved: true`; `04-ui-summary.json` — то же и `preserved: true`.
Если прогон был прерван, следующая команда сначала удаляет остатки своих аккаунтов
`@vitest.local` **до** снятия baseline (поле `leftoverBeforeCleaned`), чтобы `preserved`
отражал только текущий прогон.


## Все проблемы по важности

Нумерация — как в `FIXES_FOR_AGENT.md` (единый список 16 дефектов по критичности).
Строки с пометкой «исправлено (этап 6)» — исторические находки из `01-baseline.md`, закрытые
до начала этапа 3; они оставлены для полноты.

### Высокая критичность

| № | Проблема | Где | Статус | Тест |
| --- | --- | --- | --- | --- |
| 1 | Нет ограничения частоты попыток входа и регистрации: брутфорс паролей и перебор логинов/email ничем не ограничены, каждая попытка нагружает bcrypt | `backend/server.js:48`, `backend/routes/Router.js:13-14` | **актуально** | `07-security-gaps` → «после серии неверных паролей должен появиться 429» |
| 2 | JWT, выданный до смены пароля, остаётся валидным 30 дней — украденный токен нельзя отозвать сменой пароля | `backend/middleware/TokenCheck.js:14-19, 26-35`, `backend/controllers/changePassword.js:27-32` | **актуально** | `07-security-gaps` → «токен, выданный до смены пароля, должен становиться недействительным» |
| — | `ensureFavoritesSchema` выполнял `DELETE` избранного при каждом старте сервера (риск потери данных) | `backend/services/ensureFavoritesSchema.js` | исправлено (этап 6) | `test/scripts/06-schema-check.mjs` (23 проверки, сценарий `dirty`) |
| — | `poolBD.js` жёстко подключался к `my_crypto` и игнорировал `DATABASE_URL_TEST` — тесты нельзя было безопасно запускать | `backend/services/poolBD.js` | исправлено (этап 6) | тот же скрипт: 4 сценария конфигурации пула |

### Средняя критичность

| № | Проблема | Где | Статус | Тест |
| --- | --- | --- | --- | --- |
| 3 | Email длиннее 100 символов проходит валидацию и падает в `500` (`varying(100)`): ошибка ввода выглядит как сбой сервера | `backend/middleware/validateRegister.js:1, 14, 32-34` | **актуально** | `08-limits-and-errors` → 3 теста «email длиной 101/255/300…» |
| 4 | Тело больше 100 КБ даёт `500` вместо `413` | `backend/server.js:48, 62-71` | **актуально** | `07-security-gaps` → «тело больше лимита должно давать 413, а не 500» |
| 5 | Нет верхней границы длины `login`/`password` при входе: 5000 символов доходят до БД и bcrypt, ответ `401` вместо `400` | `backend/middleware/validateLogin.js:4-12`, `backend/controllers/login.js:8-11` | **актуально** | `07-security-gaps` → «слишком длинные login/password должны отклоняться с 400» |
| 6 | При ошибке загрузки котировок главная навсегда показывает «Загрузка...»: нет сообщения об ошибке и повтора | `src/Services/Services.js:5-30`, `src/BackgroundLayout.jsx:35-55`, `src/componets/HomePage/HomePage.jsx:47-63` | **актуально** | `ui/specs/02-home-search` → «дефект: при ошибке загрузки котировок нужен понятный статус и повтор» |
| — | Таблица `users` кодом не создавалась — требовала ручного создания (блокер для тестовой БД) | `backend/services/ensureUsersSchema.js` | исправлено (этап 6) | `test/scripts/06-schema-check.mjs` (сценарии `clean`/`dirty`) |
| — | Фактическая схема расходится с документацией: `users` — `varchar(100)/100/60/100` и колонки допускают NULL, а `README.md` и `ensureUsersSchema.js:8-16` описывают `50/15/255/255 NOT NULL`; `ensureUsersSchema` использует `CREATE TABLE IF NOT EXISTS` и не приводит существующую таблицу к описанному виду | `README.md`, `backend/services/ensureUsersSchema.js:8-16`, `test/tmp/03-schema.json` | **актуально** (источник дефекта №3) | `test/scripts/03-schema-info.mjs` (снимок схемы), `08-limits-and-errors` |
| — | Миграций нет: схема правится идемпотентным кодом при старте приложения | `backend/server.js`, `backend/services/ensure*.js` | **актуально** (процессный риск) | `test/scripts/06-schema-check.mjs` |


### Низкая критичность

| № | Проблема | Где | Статус | Тест |
| --- | --- | --- | --- | --- |
| 7 | Email уникален с учётом регистра: `Ivan@…` и `ivan@…` создают два аккаунта | `backend/middleware/validateRegister.js:12-14, 43`, `backend/services/addUsersToBD.js:7-10` | **актуально** | `08-limits-and-errors` → «повторная регистрация с тем же email в другом регистре должна давать 409» |
| 8 | Нет защитных HTTP-заголовков (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, CSP), зато отдаётся `X-Powered-By: Express` | `backend/server.js:14, 27-46, 48` | **актуально** | `07-security-gaps` → «GET / должен отдавать базовые security-заголовки»; `08-limits-and-errors` → «ответы не должны содержать X-Powered-By» |
| 9 | `/crypto/coin/:coinId` и `/crypto/chart/:coinId` не ограничивают длину `coinId` (в `/favorites` лимит 100 есть) | `backend/controllers/getCryptoById.js:4-8`, `getCryptoMarketChart.js:4-13` | **актуально** | `08-limits-and-errors` → «coinId длиннее 100 символов должен отклоняться с 400» |
| 10 | 5xx внешнего CoinGecko транслируется клиенту как 5xx нашего API — авария внешнего сервиса неотличима от нашей | `getCryptoMarkets.js:8-12`, `getTopGainers.js:8-12`, `getTopLosers.js:8-12`, `getCryptoById.js:16-20`, `getCryptoMarketChart.js:21-25` | **актуально** | `08-limits-and-errors` → «ошибка CoinGecko 500 должна транслироваться в 502» |
| 11 | Смена пароля на тот же самый разрешена (`200` вместо `400`) | `backend/controllers/changePassword.js:17-27` | **актуально** | `08-limits-and-errors` → «смена пароля на тот же самый должна отклоняться с 400» |
| 12 | Объект ошибки печатается в лог целиком: при нарушении UNIQUE в консоль попадают email/логины и текст SQL (персональные данные) | `backend/server.js:69`, `addUsers.js:23`, `login.js:25`, `changePassword.js:35`, `addFavorite.js:17`, `TokenCheck.js:17, 38`, `getCryptoMarkets.js:22` | **актуально** | автотеста нет — воспроизводится вручную (повторная регистрация) |
| 13 | `jwt.verify` без явного списка `algorithms` (сейчас спасает поведение `jsonwebtoken@9`) | `backend/middleware/TokenCheck.js:15`, `backend/services/CreateJWTtoken.js:4` | **актуально** | регрессию фиксирует `03-auth-login-token` (23 теста: `alg=none`, подделка подписи) |
| 14 | `POST /favorites` опирается на `ON CONFLICT (idusers, idcrypto)`: без составного PK эндпоинт всегда даёт `500`; логика CoinGecko продублирована в 5 контроллерах | `backend/controllers/addFavorite.js:7-12`, 5 файлов `getCrypto*` | **актуально** | автотеста нет (на копии PK есть); `05-favorites` (25) и `06-crypto-proxy` (14) — контроль |
| 15 | У поля поиска нет доступного имени (`label`/`placeholder`/`aria-label`) | `src/componets/HomePage/HomePage.jsx:53, 70-77` | **актуально** | `ui/specs/07-a11y` → «дефект: поле поиска должно иметь доступное имя» |
| 16 | У кнопки переключения темы нет доступного имени (иконки `alt=""`, нет `title`/`aria-label`) | `src/componets/Head/SunMoon/SunMoon.jsx:11-22` | **актуально** | `ui/specs/07-a11y` → «дефект: кнопка переключения темы должна иметь доступное имя» |
| — | Автотестов в проекте не было вообще (`npm test` отсутствовал и в корне, и в бэкенде) | `package.json`, `backend/package.json` | закрыто в `test/` (190 тестов) | `npm run test:all` |

**Сводно:** 16 актуальных дефектов (2 высоких, 4 средних, 10 низких) + 4 исторических находки,
закрытых на этапе 6. Детали и готовые патчи — `FIXES_FOR_AGENT.md`.


## Как запустить все тесты одной командой

Из корня проекта:

```bash
cd test
npm run test:all
```

Команда запускает `scripts/05-run-all.mjs`, который последовательно выполняет **оба** набора
(даже если первый упал — дефект-тесты пока красные, `&&` остановил бы прогон) и печатает итог:

1. `npm run test:api` → `vitest run --config api/vitest.config.mjs` — 9 файлов, **146** тестов.
   Перед прогоном global-setup проверяет/создаёт копию БД (`scripts/03-ensure-copy.mjs`),
   поднимает `backend/server.js` с `NODE_ENV=test` + `DATABASE_URL_TEST` на порту **3111**,
   подключает заглушку CoinGecko (`api/support/fetch-stub.mjs`), после прогона удаляет свои
   аккаунты `@vitest.local` и сверяет количества строк.
2. `npm run test:ui` → `playwright test --config ui/playwright.config.mjs` — 7 файлов, **44** теста.
   Поднимает свой бэкенд на **3104** и Vite на **5174** (порты 3000/5173 не используются
   и не освобождаются), переписывает запросы браузера `localhost:3000` на same-origin прокси,
   подменяет графики и Binance, блокирует остальную сеть.

Результат: сводка в консоли, полный вывод — `test/tmp/05-run-all.log`,
машинный итог — `test/tmp/05-run-all-summary.json` (`total`, `passed`, `failed` по наборам).
Код выхода `1`, пока есть красные тесты; после исправлений станет `0`.

Нужны: PostgreSQL с правом `CREATEDB`, заполненный `secrets/.env`, установленные зависимости
(`npm i` в `test/`) и браузер (`cd test && npx playwright install chromium` — на этой машине
уже установлен).


Полезные варианты:

```bash
cd test
npm run test:api                                                             # только API
npm run test:ui                                                              # только UI
npx vitest run --config api/vitest.config.mjs 07-security-gaps 08-limits     # только дефект-тесты API
npx playwright test --config ui/playwright.config.mjs 02-home-search 07-a11y # только дефект-тесты UI
npm run scan:secrets                                                         # проверка на секреты и ПДн
npm run db:ensure-copy                                                       # только подготовка копии БД
```

Ожидаемый вывод на текущем коде: API `13 failed | 133 passed (146)`, UI `3 failed | 41 passed (44)`.
После исправлений из `FIXES_FOR_AGENT.md` — `0 failed` в обоих наборах.

## Проверка `test/` на секреты и персональные данные

Скрипт: `test/scripts/05-secrets-scan.mjs` (`cd test && npm run scan:secrets`).
Правила поиска: `postgres://` / `postgresql://`, присваивания `SECRET_KEY` / `JWT_SECRET` /
`passwordBD` / `UserBD`, `Bearer <токен>`, JWT-подобные строки (`eyJ…`), ключи вида `CG-…`,
email-адреса вне `@vitest.local`. **Найденные значения не выводятся и не сохраняются** —
только правило, файл и номер строки (`test/tmp/05-secrets-scan.json`).

| Показатель | Результат |
| --- | --- |
| Файлов просканировано (весь `test/`, включая `tmp/`, `reports/`, `ui/`) | 166 |
| Критичных находок | **0** |
| Информационных находок | 14 |

Информационные находки — не секреты, а безопасные конструкции:

| Правило | Сколько | Почему не секрет |
| --- | --- | --- |
| `env-var-name` | 10 | только имена `process.env.SECRET_KEY` / `passwordBD` / `UserBD` в коде и документации |
| `pg-connection-template` | 4 | строки вида `postgres://${user}:${password}@host:port/db` — значения подставляются в рантайме |

На первом запуске скрипт по ошибке сканировал **весь проект** (включая `secrets/.env` как файл)
и записал служебный JSON в корневую `tmp/`. Значения не выводились и не сохранялись; область
исправлена на `test/` в первой же итерации, корневая `tmp/` удалена (проверено `git status`:
вне `test/` новых файлов нет).

Что проверено отдельно:

- **`test/tmp/` — логи прогонов** (`03-api-run*.log`, `04-backend.log`, `04-vite.log`,
  `05-run-all.log`, `05-secrets-scan.log`): токенов, строк подключения и реальных email нет.
  Логи тестового сервера намеренно фильтруются — в `04-backend.log` только строка старта,
  `[schema]` и **количество** строк с ошибками.
- **Сводки прогонов** `03-api-summary.json`, `04-ui-summary.json` — только количества строк
  и флаг `preserved`.
- **`04-ui-results.json`** — машинный отчёт Playwright: имена тестов и статусы, без тел запросов.
- **Скриншоты `04-ui-artifacts/*.png`** (3 падения) — проверены побайтово на ASCII-маркеры
  (`eyJ`, `Bearer`, строки подключения, `SECRET_KEY`): совпадений нет; в кадр попадают только
  синтетические аккаунты `@vitest.local`.
- **`error-context.md`** (снимки DOM упавших тестов) — только синтетические данные `@vitest.local`.
- **Тестовые данные:** все аккаунты создаются с доменом `@vitest.local`; фикстуры используют
  `example.com` / `example.test`. Реальных email, логинов и телефонов в `test/` нет.
- **Артефакты этапа 1** (`pool-check.txt`, `secrets-tracked.txt`, `secret-leak-check.txt`) —
  содержат только имена переменных и флаг «файл не отслеживается git», без значений.

## `.gitignore` тестовой папки

`test/.gitignore`:

```gitignore
node_modules/
tmp/
e2e/screenshots/
*.log
```

Исключены зависимости, все артефакты прогонов (`tmp/`), будущие скриншоты E2E и любые `*.log`
(включая `install.log`). Отчёты `reports/` и сами тесты **отслеживаются** — это результат работы.

## Изменения этого этапа (только внутри `test/`)

| Файл | Что сделано |
| --- | --- |
| `test/reports/05-summary.md` | этот сводный отчёт |
| `test/reports/FIXES_FOR_AGENT.md` | переписан: 16 пунктов по критичности, без дублей, с таблицей соответствия прежней нумерации, файлами/строками, тестом для воспроизведения и проверкой |
| `test/reports/03-api.md`, `04-ui.md` | добавлены пояснения о перенумерации в `FIXES_FOR_AGENT.md` |
| `test/reports/01-baseline.md` | формулировка про поиск секретов переписана без литеральных шаблонов |
| `test/scripts/05-secrets-scan.mjs` | новый скрипт проверки на секреты/ПДн (без вывода значений) |
| `test/scripts/05-run-all.mjs` | runner для `test:all`: запускает API и UI подряд, даже если первый набор красный, и пишет сводку |
| `test/api/support/global-setup.mjs` | добавлена предварительная очистка аккаунтов `@vitest.local` **до** снятия baseline |
| `test/ui/support/global-setup.mjs` | то же для UI-прогона |
| `test/.gitignore` | `node_modules/`, `tmp/`, `e2e/screenshots/`, `*.log` |
| `test/package.json` | добавлены скрипты `test:all` и `scan:secrets` |
| `test/api/02-auth-registration.test.js` | фикстура нестрокового email переведена на `@example.com` (семантика теста не изменилась) |

## Артефакты

| Файл | Содержимое |
| --- | --- |
| `test/tmp/05-run-all.log` | полный вывод `npm run test:all` (API + UI) |
| `test/tmp/05-run-all-summary.json` | машинный итог: по каждому набору `passed`/`failed`/`total`, код выхода |
| `test/tmp/05-run-all-console.log` | краткая сводка, которую печатает runner |
| `test/tmp/05-secrets-scan.log` | итог проверки: 0 критичных, 14 информационных |
| `test/tmp/05-secrets-scan.json` | находки без значений (правило, файл, строка) |
| `test/tmp/03-api-summary.json`, `test/tmp/04-ui-summary.json` | сохранность данных копии |

## Состояние git: вне `test/` ничего не изменено

`git status --short` после всех проверок:

```text
 M backend/services/ensureFavoritesSchema.js
 M backend/services/ensureUsersSchema.js
 M backend/services/poolBD.js
 M src/componets/HomePage/CriptoCard/CriptoCard.css
?? test/
```

- Четыре `M` — это правки **этапа 6** (`poolBD.js`, `ensureUsersSchema.js`,
  `ensureFavoritesSchema.js`, `CriptoCard.css`). Они были изменены **до** начала этапа 3
  и в этом цикле не трогались (этап 3 это уже фиксировал, состав файлов не изменился).
- `?? test/` — вся тестовая папка не отслеживается git; это единственное новое, что появилось.
- `git status --short --untracked-files=all | findstr /v "^?? test/"` → только те же 4 файла,
  то есть **вне `test/` новых, изменённых или удалённых файлов нет**.
- В корне проекта не осталось служебных папок: `tmp/` (создавалась ошибочным первым прогоном
  сканера) удалена, `node_modules/.vite` — кеш вашего dev-сервера, существовал до этапа.
- Тестовые серверы остановлены: порты 3104/5174 и 3111 свободны, процессы 3000/5173
  (ваши dev-серверы) не останавливались и не использовались.

После исправлений из `FIXES_FOR_AGENT.md` — `0 failed` в обоих наборах.
