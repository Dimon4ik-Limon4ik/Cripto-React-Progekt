# Этап 1. Baseline: структура, зависимости, сборка, линт, тесты, схема БД

- **Дата:** 15.11.2026
- **Коммит:** `7fda691` («v 0.1»)
- **Окружение:** Windows 10.0.19045, Node.js **v24.11.0**, npm **11.6.1**, Vite **7.3.6**, ESLint **9.39.5**
- **Область этапа:** только чтение кода и запуск команд. Код проекта не изменялся, файлы не удалялись и не переименовывались.
- **Создано в рамках правил:** только `test/tmp/**` (логи и артефакты прогонов) и `test/reports/01-baseline.md`.
- **Секреты:** файл `secrets/.env` **не открывался и не выводился**. Значения переменных нигде в отчёте не приводятся; имена переменных взяты из `README.md` и `secrets/.env.example` (шаблон с заполнителями).

### Как обходил ограничения правил

| Ситуация | Решение |
| --- | --- |
| `npm run build` пишет в существующую папку `dist/` (правило 1 — не изменять существующие файлы) | Сборка выполнена той же командой Vite, но с выводом в `test/tmp/dist`: `npx vite build --outDir test/tmp/dist --emptyOutDir`. Корневой `dist/` (метка 15.11.2026 22:17) **не перезаписан**. |
| Зависимости проекта | Уже установлены (`node_modules` в корне и в `backend/`), установка не потребовалась — проверено через `npm ls --depth=0`. Ничего в `package.json`/lock-файлы не добавлял. |
| Подключение к БД | На этом этапе не выполнялось вообще. Проверены только файлы схемы/подключения. Установлено, что тестовую БД проект сейчас использовать **не умеет** (см. F1) — это блокер для следующих этапов. |

---

## 1. Структура проекта

Два независимых npm-пакета: фронтенд в корне, бэкенд в `backend/`.

```text
Cripto-React-Progekt/
├── index.html                 # HTML-точка входа Vite
├── vite.config.js             # Vite: host 127.0.0.1, port 5173, плагин React
├── eslint.config.js           # ESLint 9 (flat config): браузерные + node-глобали
├── package.json               # фронтенд (React 19, Vite 7)
├── package-lock.json
├── dist/                      # собранный бандл (в .gitignore)
├── build_err.txt              # пустой файл (0 байт), отслеживается git
├── secrets/
│   ├── .env                   # реальные секреты, НЕ в git (не читал)
│   └── .env.example           # шаблон с заполнителями (в git)
├── src/                       # фронтенд
│   ├── main.jsx, BackgroundLayout.jsx, index.css, Palette.css, TEST.css
│   ├── Context/               # AuthContext, FavoritesContext, NotificationsContext, CriptoContext, SunMoonContext
│   ├── Services/              # Services.js, APIreg/APIlogin, tokenStorage, profileApi, favoritesApi, …
│   └── componets/             # Head, HomePage, CoinPage, Portfolio, Profile, Authorization, notifications, Picture
├── backend/
│   ├── server.js              # Express 5: CORS, JSON, роутеры, обработка ошибок, ensure*Schema
│   ├── routes/                # Router.js (/auth), cryptoRouter.js (/crypto), favoritesRouter.js (/favorites)
│   ├── controllers/           # 14 обработчиков
│   ├── middleware/            # TokenCheck + 5 валидаторов
│   ├── services/              # poolBD, addUsersToBD, CreateJWTtoken, getUserFavorites, ensureUsersSchema, ensureFavoritesSchema
│   ├── endpoin/apiCoinGecko.js# ранний модуль CoinGecko (не подключён к роутерам)
│   ├── eslint.config.js, jsconfig.json, package.json, package-lock.json
│   └── node_modules/
└── test/                      # создано мной: tmp/ (артефакты), reports/ (отчёты)
```

Состав `src/`: **26** `.jsx`, **14** `.js`, **19** `.css`, **17** `.svg` — всего 76 файлов (плюс каталоги компонентов).
Состав `backend/`: **31** `.js`-файл собственного кода (6 services, 14 controllers, 6 middleware, 3 routes, `server.js`, `endpoin/apiCoinGecko.js`).

Наблюдения по структуре (не влияют на сборку, но мешают навигации):

- Авторские опечатки в именах сохранены: `componets`, `endpoin`, `Progekt`, `SunMoonContext.js`, `CriptoContext.js`.
- Дубликаты SVG: иконки есть и в `src/componets/Picture/`, и в `src/componets/Head/Picture/`.
- `src/TEST.css` — файл стилей, не тест (легко спутать при поиске тестов).
- `backend/endpoin/apiCoinGecko.js` не импортируется ни одним роутером (мёртвый код).

---

## 2. Скрипты npm

### Корень (фронтенд), `package.json:6-11`

| Скрипт | Команда | Статус |
| --- | --- | --- |
| `dev` | `vite` | есть |
| `build` | `vite build` | есть, работает |
| `lint` | `eslint .` | есть, проходит |
| `preview` | `vite preview` | есть |
| `test` | — | **отсутствует** |

### `backend/package.json:7-11`

| Скрипт | Команда | Статус |
| --- | --- | --- |
| `test` | `echo "Error: no test specified" && exit 1` | **заглушка, всегда падает** |
| `start` | `node server.js` | есть |
| `dev` | `nodemon server.js` | есть |
| `lint` | — | **отсутствует** (хотя `backend/eslint.config.js` есть) |

---

## 3. Зависимости

Установка не потребовалась: оба `node_modules` на месте, lock-файлы присутствуют.

**Фронтенд (корень), `npm ls --depth=0`:**

- dependencies: `react@19.2.8`, `react-dom@19.2.8`, `react-router-dom@7.18.2`
- devDependencies: `vite@7.3.6`, `@vitejs/plugin-react@5.2.0`, `eslint@9.39.5`, `@eslint/js@9.39.5`, `eslint-plugin-react-hooks@5.2.0`, `eslint-plugin-react-refresh@0.4.26`, `globals@16.5.0`, `@types/react@19.2.17`, `@types/react-dom@19.2.3`
- **extraneous** (стоят в `node_modules`, но отсутствуют в `package.json`): `cors@2.8.6`, `object-assign@4.1.1`, `vary@1.1.2` → см. F7

**Бэкенд:**

- dependencies: `express@5.2.1`, `pg@8.23.0`, `bcrypt@6.0.0`, `jsonwebtoken@9.0.3`, `dotenv@17.4.2`
- devDependencies: `nodemon@3.1.14`
- тестовых библиотек нет ни в одном пакете.

## 4. Сборка React

Команда (с выводом в `test/tmp/`, чтобы не трогать корневой `dist/`):

```bash
npx vite build --outDir test/tmp/dist --emptyOutDir
```

Результат — **успешно, exit code 0**, лог: `test/tmp/build.log`.

```text
vite v7.3.6 building client environment for production...
✓ 103 modules transformed.
test/tmp/dist/index.html                  0.65 kB │ gzip:  0.42 kB
test/tmp/dist/assets/index-*.css         53.27 kB │ gzip:  9.48 kB
test/tmp/dist/assets/index-*.js         292.16 kB │ gzip: 91.36 kB
✓ built in 1.76s
```

Предупреждений (в т.ч. о размере чанка) нет. Ошибок импортов/резолва нет.
Корневой `dist/` не изменялся: его метка времени — 22:17, сборка выполнялась в 22:32.

---

## 5. ESLint

| Запуск | Команда | Результат |
| --- | --- | --- |
| Фронтенд (`src/`) | `npx eslint src` | **0 ошибок, 0 предупреждений** |
| Проект без тестового каталога | `npx eslint . --ignore-pattern "test/**"` | **0 ошибок, 0 предупреждений** |
| Бэкенд | `cd backend && npx eslint .` | **0 ошибок, 0 предупреждений** |

Дополнительный эксперимент: полный `npx eslint .` уже после сборки даёт **115 ошибок**, но все они относятся к минифицированному бандлу `test/tmp/dist/assets/index-*.js` (`no-undef`, `no-prototype-builtins`, `no-empty` и т.п.) — это артефакт, а не код проекта. Причина: `eslint.config.js:8` игнорирует только каталог `dist`, а не произвольные каталоги сборки (см. F9).

Вывод: **линт на текущем коде чистый**, регрессий по стилю нет. Отсутствие `lint`-скрипта в `backend/package.json` — организационный пробел (F10).

---

## 6. Тесты

### Что запускалось

| Пакет | Команда | Результат |
| --- | --- | --- |
| Фронтенд | `npm test` | `npm error Missing script: "test"` — **тест-скрипта нет** |
| Бэкенд | `cd backend && npm test` | `"Error: no test specified"`, exit code **1** — заглушка |

### Что реально существует

**Ни одного автоматического теста в коде проекта нет.** Проверено:

- поиск по репозиторию `describe(`, `it(`, `test(`, `expect(` — совпадения только на `RegExp.prototype.test()` и `server.js:20 .split(",")`, ни одного тест-кейса;
- поиск `vitest|jest|mocha|supertest|playwright|cypress|@testing-library` — **0 совпадений**;
- маски `src/**/*.test.*`, `src/**/*.spec.*`, `backend/**/*.{test,spec}.*` — в собственном коде **нет файлов** (все найденные `*.test.*` лежат в `backend/node_modules/bcrypt`, `pg-protocol`, `pstree.remy`, `simple-update-notifier`);
- каталогов `__tests__`, `tests/` (кроме `node_modules`) нет;
- CI (`.github/workflows`) отсутствует;
- README прямо это фиксирует: `README.md:378` — «Нет автоматических тестов».

### Каких тестов нет — по слоям (подробная матрица в разделе 8)

- **Юнит-тесты фронта:** форматтеры (`src/componets/CoinPage/formatPrice.js`, `src/componets/Portfolio/formatPortfolio.js`), хук `useCoinHistory.js`, клиентские валидаторы логина/email/пароля в `Authorization.jsx`.
- **Компонентные тесты:** `CriptoCard`, `Star`, `PriceChart`, `MiniChart`, `Authorization`, `Profile` и модальные окна, `notifications`.
- **Тесты контекстов:** `AuthContext`, `FavoritesContext` (оптимистичное обновление и откат при ошибке), `NotificationsContext`.
- **Тесты сервисного слоя фронта:** `Services.js` (CoinGecko/Binance, кэш истории), `favoritesApi.js`, `profileApi.js`, `tokenCheck.js`, `tokenStorage.js`.
- **Юнит-тесты бэка:** 5 валидаторов (`validateRegister/Login/ChangePassword/DeleteAccount/FavoriteCoin`), `TokenCheck`, `CreateJWTtoken`, `addUsersToBD`, `getUserFavorites`.
- **Интеграционные тесты API:** все 16 эндпоинтов (auth, crypto, favorites, health).
- **Тесты схемы БД:** идемпотентность `ensureUsersSchema`/`ensureFavoritesSchema`, каскадное удаление, составной PK, обработка дубликатов.
- **Контрактные/e2e тесты** фронт↔бэк, проверки CORS и обработки ошибок (404, `entity.parse.failed`, 500).
- **Тесты безопасности** (подделка JWT, обход `TokenCheck`, SQL-инъекции, брутфорс) — план следующих этапов.
- **Smoke-тесты** сборки и запуска в CI (CI отсутствует).

---

## 7. База данных: миграции и схема

### Миграций нет

- Каталогов `migrations/`, `db/`, `sql/` нет; файлов `*.sql` в проекте нет.
- Инструментов версионирования схемы нет: поиск `knex|sequelize|prisma|alembic|flyway|migrations` — **0 совпадений**.
- Схема готовится «на лету» при старте сервера: `backend/server.js:74-86` вызывает `ensureUsersSchema()` и `ensureFavoritesSchema()` до `app.listen`.

### Что делает код со схемой

`backend/services/ensureUsersSchema.js:6-9`

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

`backend/services/ensureFavoritesSchema.js` — последовательность операций:

| Строки | Операция |
| --- | --- |
| 7-13 | `CREATE TABLE IF NOT EXISTS cryptoinfavorites (idusers INTEGER NOT NULL, idcrypto VARCHAR(100) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())` |
| 15-18 | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS created_at ...` |
| 21-24 | **`DELETE FROM cryptoinfavorites WHERE idusers IS NULL OR idcrypto IS NULL`** |
| 27-33 | **`DELETE FROM cryptoinfavorites a USING cryptoinfavorites b ...`** (удаление дубликатов) |
| 35-43 | `ALTER COLUMN idusers/idcrypto SET NOT NULL` |
| 45-59 | `DO $$ ... ADD CONSTRAINT cryptoinfavorites_pkey PRIMARY KEY (idusers, idcrypto)` |
| 61-77 | `DO $$ ... ADD CONSTRAINT cryptoinfavorites_idusers_fkey FOREIGN KEY (idusers) REFERENCES users(idusers) ON DELETE CASCADE` |

Таблица `users` в коде **не создаётся** — только `ALTER`. По `README.md:241-249, 267` её нужно создать вручную:

```sql
CREATE TABLE IF NOT EXISTS users (
  idusers    SERIAL PRIMARY KEY,
  name       VARCHAR(50)  NOT NULL,
  login      VARCHAR(15)  NOT NULL UNIQUE,
  password   VARCHAR(255) NOT NULL,   -- bcrypt-хеш
  email      VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### Подключение к БД

`backend/services/poolBD.js:18-24`:

- хост `localhost`, порт `5432` и **имя БД `my_crypto` захардкожены**;
- пользователь/пароль берутся из `secrets/.env` (`UserBD`, `passwordBD`);
- `DATABASE_URL` / `DATABASE_URL_TEST` / `NODE_ENV` **не используются**;
- `dotenv` читает фиксированный путь `secrets/.env` (`poolBD.js:7`, `server.js:12`).

Следствия для дальнейших этапов: подключить проект к отдельной тестовой БД без правки `poolBD.js` **невозможно** (F1), а очистка данных при старте затронет ту БД, на которую указывает рабочая конфигурация (F2). Поэтому запуск сервера и любые проверки с БД на этапе 1 не выполнялись.

### Сиды/фикстуры

Сидов и фикстур нет. Тестовых данных в БД не создавалось.

---

## 8. Матрица покрытия: что уже покрыто, а что нет

| Область | Есть ли тесты | Что именно отсутствует |
| --- | --- | --- |
| Сборка фронтенда | Нет | smoke-тест «`vite build` проходит» (проверено вручную: OK) |
| ESLint | Нет | прогон линта в CI; `lint`-скрипт в бэкенде |
| Форматтеры цен/процентов (`formatPrice.js`, `formatPortfolio.js`) | **Нет** | юнит-тесты граничных значений (0, null, очень большие числа, проценты) |
| Хуки (`useCoinHistory.js`) | **Нет** | тесты кэша и переключения периодов |
| Компоненты (`CriptoCard`, `Star`, `PriceChart`, `MiniChart`, `TypeWriterText`, тикеры) | **Нет** | рендер, пропсы, состояния загрузки/ошибки |
| Страницы (`HomePage`, `CoinPage`, `Portfolio`, `Profile`, `Authorization`) | **Нет** | рендер, поиск, валидация форм, модальные окна |
| Контексты (`AuthContext`, `FavoritesContext`, `NotificationsContext`) | **Нет** | восстановление сессии, optimistic update + откат |
| Сервисы фронта (`Services.js`, `favoritesApi.js`, `profileApi.js`, `tokenStorage.js`) | **Нет** | моки fetch, обработка 401/500, таймауты |
| Роутинг и защита маршрутов (`BackgroundLayout.jsx`) | **Нет** | редиректы для гостя/авторизованного |
| Валидаторы бэка (5 middleware) | **Нет** | юнит-тесты граничных значений (длины, email, пробелы, управляющие символы) |
| `TokenCheck` | **Нет** | отсутствующий/битый/просроченный JWT, несуществующий userId |
| Контроллеры auth (регистрация, вход, профиль, смена пароля, удаление) | **Нет** | успех/ошибки, дубликаты login/email, bcrypt-проверки |
| Контроллеры favorites | **Нет** | идемпотентность добавления, удаление одной/всех, изоляция пользователей |
| Контроллеры crypto (прокси CoinGecko) | **Нет** | кэш/ошибки внешнего API, отсутствие утечки ключа |
| Обработка ошибок (`server.js:58-71`) | **Нет** | 404, кривой JSON → 400, внутренняя ошибка → 500 |
| CORS (`server.js:17-46`) | **Нет** | разрешённые/запрещённые Origin, preflight 204 |
| Схема БД (`ensureUsersSchema`, `ensureFavoritesSchema`) | **Нет** | идемпотентность, каскад, PK, дубликаты, NULL |
| Миграции | **Нет** | самого механизма миграций (см. F5) |
| E2E / контрактные тесты фронт↔бэк | **Нет** | всё |
| Безопасность | **Нет** | план следующего этапа |
| CI | **Нет** | workflow-файлов нет |

**Итог:** автоматических тестов — 0. Проверены только сборка и линт (вручную, результат положительный).

---

## 9. Находки

> Формат: **что** → где (файл:строка) → как воспроизвести → критичность → как исправить.
> Значения секретов не приводятся.

### F1. Невозможно подключиться к тестовой БД: имя базы захардкожено, `DATABASE_URL_TEST` не читается

- **Что:** пул создаётся с фиксированными `host: "localhost"`, `port: 5432`, `database: "my_crypto"`, без поддержки `DATABASE_URL`/`DATABASE_URL_TEST`/`NODE_ENV`.
- **Где:** `backend/services/poolBD.js:18-24`; путь к env захардкожен в `poolBD.js:7` и `server.js:12`.
- **Как воспроизвести:**
  ```bash
  cd backend
  node -e "import('./services/poolBD.js').then(m=>console.log(m.pool.options.database, m.pool.options.host, m.pool.options.port))"
  ```
  Вывод всегда `my_crypto localhost 5432`, независимо от `DATABASE_URL_TEST`.
  **Проверено фактически:** `db=my_crypto host=localhost port=5432` (лог: `test/tmp/pool-check.txt`). Соединение с БД при этом не открывалось — создаётся только объект пула, затем сразу `pool.end()`; значения переменных окружения не печатались.
- **Критичность: высокая.** Нарушает изоляцию тестов (правило 4): тестовый прогон пойдёт в рабочую БД.
- **Как исправить:** брать строку подключения из env (`DATABASE_URL_TEST` при `NODE_ENV=test`, иначе `DATABASE_URL`), при старте падать с явной ошибкой, если в тестовом режиме имя БД не содержит `_test`; путь к env-файлу сделать настраиваемым, а не фиксированным.

### F2. Деструктивные SQL-операции выполняются при каждом старте сервера

- **Что:** `ensureFavoritesSchema()` при каждом запуске делает `DELETE` (строки без владельца, дубликаты) и `ALTER TABLE` по таблице избранного, до `app.listen`. Всё это — на той БД, куда указывает конфигурация.
- **Где:** `backend/services/ensureFavoritesSchema.js:21-24, 27-33` (DELETE), `35-43` (SET NOT NULL), `server.js:82-86` (вызов).
- **Как воспроизвести:** по коду; динамически запускать не стал — в текущей конфигурации это означало бы работу с рабочей БД, что запрещено правилом 4. Достаточно `npm start` в `backend/`.
- **Критичность: высокая.** Риск потери данных при запуске против реальной БД; в тестах — неконтролируемые побочные эффекты.
- **Как исправить:** вынести схему в миграции, запускаемые отдельной командой; убрать очистку данных из старта приложения (или выполнять только по явному флагу `--fix-data`); добавить проверку окружения перед DDL/DML.

### F3. Таблица `users` не создаётся кодом — на чистой БД старт деградирует молча

- **Что:** `ensureUsersSchema()` делает `ALTER TABLE users`, но `CREATE TABLE users` нет нигде, кроме README. Ошибка ловится `try/catch` и только логируется, сервер продолжает работать.
- **Где:** `backend/services/ensureUsersSchema.js:6-9`, `backend/server.js:74-78`, `README.md:241-249, 267`.
- **Как воспроизвести:** на пустой БД (после появления поддержки тестовой БД) — `npm start`; в логе появится `Не удалось подготовить схему пользователей: relation "users" does not exist`, при этом `/auth/addUsers` будет падать.
- **Критичность: высокая.** Тестовая БД «с нуля» не поднимется; ошибка не фатальна и легко остаётся незамеченной.
- **Как исправить:** добавить идемпотентную миграцию `CREATE TABLE IF NOT EXISTS users (...)`; ошибки подготовки схемы считать фатальными в тестовом окружении.

### F4. Тестовой инфраструктуры нет ни на фронте, ни на бэке

- **Что:** во фронтенде отсутствует `test`-скрипт и любой раннер; в бэкенде `test` — заглушка, всегда `exit 1`.
- **Где:** `package.json:6-11` (корень), `backend/package.json:8`.
- **Как воспроизвести:** `npm test` в корне → `Missing script: "test"`; `cd backend && npm test` → `"Error: no test specified"`, код 1.
- **Критичность: средняя.** Нет защиты от регрессий; любой следующий этап начинается с нуля.
- **Как исправить:** добавить в `test/package.json` собственный раннер (например, Vitest для чистых функций фронта и Node-тестов бэкенда), не меняя корневые манифесты; либо согласованно добавить скрипты в проект (требует вашего разрешения — правило 1).

### F5. Нет миграций и версионирования схемы

- **Что:** схема меняется императивным кодом при старте; история изменений не отслеживается, откатов нет.
- **Где:** `backend/services/ensureUsersSchema.js`, `backend/services/ensureFavoritesSchema.js`, `backend/server.js:74-86`.
- **Как воспроизвести:** поиск `migrations|knex|sequelize|prisma|flyway` — 0 совпадений; каталогов с SQL нет.
- **Критичность: средняя.** Невозможно гарантированно воспроизвести схему в тестовой БД и сравнивать окружения.
- **Как исправить:** ввести простой SQL-мигратор (папка `migrations/NNN_name.sql` + таблица `schema_migrations`) и отдельную команду `npm run migrate`.

### F6. Нет CI: сборка/линт/тесты не проверяются автоматически

- **Что:** каталога `.github/workflows` нет, других CI-конфигов нет.
- **Где:** корень репозитория.
- **Как воспроизвести:** `dir /b .github` → каталог отсутствует.
- **Критичность: средняя.** Baseline-проверки (build, lint) держатся только на ручном запуске.
- **Как исправить:** добавить workflow: `npm ci`, `npm run lint`, `npm run build`, затем тесты из `test/`.

### F7. В корневом `node_modules` есть лишние пакеты

- **Что:** `cors@2.8.6`, `object-assign@4.1.1`, `vary@1.1.2` установлены, но отсутствуют в `package.json`/lock (`extraneous`).
- **Где:** корневой `node_modules`. В коде эти пакеты не импортируются: `cors` не используется вовсе (CORS реализован вручную в `server.js:27-46`), `object-assign`/`vary` — транзитивные остатки.
- **Как воспроизвести:** `npm ls --depth=0` → три строки с пометкой `extraneous`.
- **Критичность: низкая.** «Грязное» дерево зависимостей, расхождение с lock-файлом.
- **Как исправить:** `npm prune` (очистка `node_modules` без изменения манифестов).

### F8. В рабочем дереве лежат артефакты сборки и пустой `build_err.txt` под контролем git

- **Что:** `dist/` присутствует локально (в `.gitignore`), а пустой `build_err.txt` (0 байт) **отслеживается git**.
- **Где:** `build_err.txt` (корень), `dist/` (корень), `README.md:382`.
- **Как воспроизвести:** `git ls-files build_err.txt` → файл в индексе; `dir build_err.txt` → 0 байт.
- **Критичность: низкая.** Мусор в репозитории, ложные ожидания у новых участников.
- **Как исправить:** удалить `build_err.txt` из индекса и добавить в `.gitignore` (только с вашего разрешения — правило 1).

### F9. ESLint игнорирует только `dist`

- **Что:** `globalIgnores(['dist'])` — любой другой каталог сборки/артефактов попадает под линт и даёт сотни ложных ошибок.
- **Где:** `eslint.config.js:8`.
- **Как воспроизвести:** собрать в подкаталог (`npx vite build --outDir test/tmp/dist`) и запустить `npx eslint .` → **115 ошибок** только на бандле.
- **Критичность: низкая.** Ложные срабатывания при нестандартном `outDir`.
- **Как исправить:** добавить в `globalIgnores` шаблоны `**/dist/**`, `test/tmp/**`.

### F10. В бэкенде нет `lint`-скрипта при наличии конфига ESLint

- **Что:** `backend/eslint.config.js` есть, но `npm run lint` в `backend/` не существует.
- **Где:** `backend/package.json:7-11`, `backend/eslint.config.js`.
- **Как воспроизвести:** `cd backend && npm run lint` → `Missing script: "lint"`.
- **Критичность: низкая.** Линт бэкенда легко забыть (сейчас он чистый — проверено `npx eslint .`).
- **Как исправить:** добавить `"lint": "eslint ."` в `backend/package.json`.

### F11. `jsconfig.json` объявляет CommonJS при `"type": "module"`

- **Что:** `module: "commonjs"` конфликтует с ESM-режимом пакета.
- **Где:** `backend/jsconfig.json:3`, `backend/package.json:4`.
- **Как воспроизвести:** сравнить два файла; IDE может предлагать `require` вместо `import`.
- **Критичность: низкая.** Влияет на подсказки IDE, не на рантайм.
- **Как исправить:** `"module": "esnext"` (или `"nodenext"`).

### F12. Не указаны требования к версии Node

- **Что:** в манифестах нет `engines`, хотя Vite 7 требует Node 20.19+/22.12+.
- **Где:** `package.json` (корень), `backend/package.json`; требование описано только в `README.md:135`.
- **Как воспроизвести:** `npm run build` на Node 18 → ошибка Vite; в манифестах ограничений нет.
- **Критичность: низкая.** Проверено на Node 24.11.0 — работает.
- **Как исправить:** добавить `"engines": { "node": ">=20.19" }`.

### F13 (информационно). В рабочем дереве есть постороннее изменение

- **Что:** `src/componets/HomePage/CriptoCard/CriptoCard.css` изменён до начала моей работы (1 удалённая строка).
- **Где:** `git status` → `M src/componets/HomePage/CriptoCard/CriptoCard.css`; `git diff --stat` → `1 file changed, 1 deletion(-)`.
- **Как воспроизвести:** `git --no-pager diff src/componets/HomePage/CriptoCard/CriptoCard.css`.
- **Критичность: информационная.** Не моё изменение; учитывать при будущих диффах.
- **Как исправить:** не требуется (по желанию — `git checkout --` файла, но это ваше решение).

### F14 (проверено, проблемы нет). Секреты не утекли в репозиторий и в код

- **Что проверял:** `git ls-files secrets .env build_err.txt` → в индексе только `secrets/.env.example` и `build_err.txt`; `secrets/.env` **не отслеживается** git.
- **Поиск захардкоженных секретов** (ключи вида `CG-…`, строки подключения к PostgreSQL,
  литеральные значения паролей в коде) по исходникам — единственное совпадение: заполнитель
  `CG-xxxx…` в `README.md:212`. Строки подключения в коде собираются в рантайме из переменных
  окружения, литеральных значений нет.
- **Критичность:** проблемы не выявлено. `secrets/.env` я не открывал.

---

## 10. Артефакты прогона и как повторить

Все артефакты — внутри `test/`, исходные файлы проекта не менялись.

| Файл | Содержимое |
| --- | --- |
| `test/tmp/build.log` | лог `vite build` (успех) |
| `test/tmp/eslint-src.log` | линт `src/` (пусто = 0 ошибок) |
| `test/tmp/eslint-root.log` | линт проекта без `test/` (пусто) |
| `test/tmp/eslint-back.log` | линт бэкенда (`LINT_EXIT=0`) |
| `test/tmp/eslint-front.log` | линт с захватом бандла (115 ложных ошибок на `test/tmp/dist`) |
| `test/tmp/front-npm-test.log` | `npm test` в корне → `Missing script` |
| `test/tmp/backend-npm-test.log` | `npm test` в бэкенде → заглушка, exit 1 |
| `test/tmp/npm-ls-front.txt`, `npm-ls-back.txt` | дерево установленных зависимостей |
| `test/tmp/versions.txt` | Node v24.11.0, npm 11.6.1 |
| `test/tmp/backend-src.txt`, `src-files.txt` | инвентарь файлов (без `node_modules`) |
| `test/tmp/tests-mask.txt` | поиск тестов по маскам (только `node_modules`) |
| `test/tmp/git-status.txt` | состояние git до/после (pre-existing правка CSS) |
| `test/tmp/secrets-tracked.txt` | какие файлы секретов в индексе git |
| `test/tmp/dist-info.txt` | метки времени корневого `dist/` и сборки в `test/tmp/dist` |
| `test/tmp/counts.txt` | подсчёт файлов `src/`: 26 jsx, 14 js, 19 css, 17 svg |
| `test/tmp/pool-check.txt` | проверка конфигурации пула: только `db/host/port` (F1) |

Повторить baseline:

```bash
npm ls --depth=0
npx vite build --outDir test/tmp/dist --emptyOutDir
npx eslint src
npx eslint . --ignore-pattern "test/**"
cd backend && npx eslint . && npm test
cd .. && npm test
```

---

## 11. Выводы и блокеры для следующего этапа

**Хорошее:** проект собирается без ошибок и предупреждений, ESLint чистый на всех трёх областях, зависимости установлены и соответствуют манифестам, секреты не закоммичены и не захардкожены, структура читаемая (React 19 + Vite 7, Express 5 + pg).

**Плохое:** автоматических тестов нет вообще; миграций нет; схема применяется деструктивным кодом при старте; `users` создаётся только вручную.

**Блокер (требует вашего решения перед этапом с БД):**
1. `backend/services/poolBD.js` жёстко использует БД `my_crypto` — переменная `DATABASE_URL_TEST` игнорируется (F1). Без изменения кода (или без вашего разрешения на правку) я не могу безопасно подключить тесты к тестовой БД.
2. Таблица `users` кодом не создаётся (F3) — для тестовой БД её нужно создать вручную либо добавить миграцию.
3. `ensureFavoritesSchema` выполняет `DELETE` при старте (F2) — запускать сервер против любой БД с ценными данными нельзя.

**Варианты для этапа 2 (выберите):**
- **A.** Вы правите `poolBD.js` (поддержка `DATABASE_URL_TEST` + `NODE_ENV=test`) и создаёте `users` в тестовой БД — я продолжаю с интеграционными тестами API.
- **B.** Разрешаете мне сделать тестовую обвязку в `test/` без правки проекта: отдельный тестовый сервер-двойник (свои `pool`/конфиг в `test/`, импорт контроллеров и роутеров как есть) — прод-код не меняется.
- **C.** Начинаем с этапа без БД: юнит-тесты чистых функций и валидаторов + статический анализ безопасности (JWT, SQL-инъекции, утечки) — БД откладываем.

Жду «дальше» и выбор варианта.


