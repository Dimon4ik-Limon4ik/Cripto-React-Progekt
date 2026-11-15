# 06. Исправление F1–F3 (тестовая БД и безопасная схема)

Ветка: `main`. Рабочая база `my_crypto` не использовалась, сервер против неё не запускался.

## Изменённые файлы

| Файл | Что сделано |
| --- | --- |
| `backend/services/poolBD.js` | F1: тестовый режим проверяет имя БД в `DATABASE_URL_TEST` |
| `backend/services/ensureFavoritesSchema.js` | F2: переписано без `DELETE`, одна транзакция, проверки по колонкам |
| `backend/services/ensureUsersSchema.js` | F3: идемпотентное создание `users`, `created_at` сохранён |

`backend/server.js` **не менялся**: он уже ловит ошибки подготовки схемы, логирует и продолжает старт.

## F1 — защита от подключения к рабочей базе в тестах

- При `NODE_ENV=test` обязательна `DATABASE_URL_TEST` (иначе ошибка, пул не создаётся).
- Имя базы берётся из пути URL (`new URL(...).pathname`, декодируется) и проверяется
  регистронезависимо на вхождение `test`.
- Если имя не определяется или не содержит `test` — ошибка, пул не создаётся.
- В тексте ошибок только имена переменных: ни URL, ни имя базы, ни пароль не выводятся.
- Вне `NODE_ENV=test` пул создаётся ровно как раньше: `localhost`, `5432`, `my_crypto`,
  `UserBD`/`passwordBD` из `secrets/.env`.

Фактические проверки:

| Проверка | Результат |
| --- | --- |
| Прод-путь (без `NODE_ENV`) | `db=my_crypto host=localhost port=5432 connectionString=undefined` |
| `NODE_ENV=test`, `DATABASE_URL_TEST` нет | ошибка «переменная ... не задана», пул не создан |
| `NODE_ENV=test`, база без `test` в имени | ошибка «имя базы ... не содержит «test»», имя базы и пароль не показаны |
| `NODE_ENV=test`, база `crypto_app_test` | используется только `connectionString` |

## F2 — `ensureFavoritesSchema` без удаления данных

- Все операции — на одном клиенте в одной транзакции: `BEGIN` → шаги → `COMMIT`,
  при ошибке `ROLLBACK` и проброс исключения в `server.js` (он логирует и продолжает старт),
  `client.release()` в `finally`.
- `CREATE TABLE IF NOT EXISTS cryptoinfavorites` и
  `ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` сохранены.
- `DELETE` отсутствует полностью. Проблемные строки только считаются агрегатами
  (`count(*)`): NULL-владельцы, NULL-монеты, лишние дубликаты пар, избранные без пользователя.
- `SET NOT NULL` добавляется, только если у колонки ещё не стоит `attnotnull` и нет NULL-строк.
- `PRIMARY KEY (idusers, idcrypto)` — проверка по колонкам через `pg_constraint.conkey`
  (`array_agg` имён колонок), а не «есть хоть один PK». Если у таблицы другой PK — шаг
  пропускается с предупреждением (второй PK в PostgreSQL невозможен).
- `FOREIGN KEY (idusers) REFERENCES users(idusers) ON DELETE CASCADE` — проверка по
  колонкам, таблице-цели и `confdeltype = 'c'`. Если есть подходящий — ничего не делается.
  Если есть FK на `users(idusers)` без CASCADE — ограничение не пересоздаётся (самый
  безопасный вариант), пишется предупреждение.
- Сироты (избранное с несуществующим пользователем) блокируют создание FK; строки не удаляются.
- Каждый необязательный DDL-шаг выполняется под `SAVEPOINT`: ошибка откатывает только шаг,
  транзакция и данные остаются целыми, в лог попадает предупреждение.
- Предупреждения содержат **количество** проблемных строк и не содержат самих данных.

Пример вывода на «грязной» базе (синтетические данные):

```
[schema] cryptoinfavorites: NOT NULL для idusers не добавлен: строк с NULL — 1
[schema] cryptoinfavorites: NOT NULL для idcrypto не добавлен: строк с NULL — 1
[schema] cryptoinfavorites: PRIMARY KEY (idusers, idcrypto) не добавлен: NULL idusers — 1, NULL idcrypto — 1, дубликатов пар — 1
[schema] cryptoinfavorites: FOREIGN KEY не добавлен: избранных с несуществующим пользователем — 1
```

## F3 — `ensureUsersSchema` создаёт `users`

Добавлен `CREATE TABLE IF NOT EXISTS users` с колонками, которые реально используются кодом
(`idusers`, `name`, `login`, `password`, `email`, `created_at`), по минимальной схеме из `README.md`:
`idusers SERIAL PRIMARY KEY`, `name VARCHAR(50)`, `login VARCHAR(15) UNIQUE`,
`password VARCHAR(255)`, `email VARCHAR(255) UNIQUE`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.

- Существующая таблица и её данные не меняются: `CREATE IF NOT EXISTS` для неё no-op.
- `ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at ...` сохранён для старых баз.
- Ошибки не проглатываются: функция пробрасывает исключение, `server.js` логирует его
  (`Не удалось подготовить схему пользователей: ...`) и продолжает запуск.

## Как проверялось

Команда (из корня проекта):

```
node test/scripts/06-schema-check.mjs
```

Скрипт создаёт только тестовые базы (`crypto_app_test`, `crypto_app_test_dirty`), имена
содержат `test`; служебное подключение — к базе `postgres` только для `CREATE/DROP DATABASE`.
`my_crypto` не использовалась. Учётные данные читаются `dotenv` в рантайме и нигде не печатаются.

Сценарии:

1. **clean** — пустая тестовая база: оба `ensure*` запускаются дважды подряд.
2. **dirty** — унаследованная схема с NULL-владельцем, NULL-монетой, дубликатом пары
   и избранным несуществующего пользователя: оба `ensure*` запускаются дважды подряд.

Результат (скрипт прогнан дважды, вывод идентичен):

```
PASS clean: 4 запуска ensure* без исключений
PASS clean: предупреждений нет
PASS clean: users создана с колонками idusers/name/login/password/email/created_at
PASS clean: users.created_at NOT NULL
PASS clean: cryptoinfavorites содержит idusers/idcrypto/created_at
PASS clean: idusers/idcrypto NOT NULL
PASS clean: PRIMARY KEY (idusers, idcrypto) создан
PASS clean: FOREIGN KEY (idusers) REFERENCES users ON DELETE CASCADE создан
PASS clean: пустая база осталась пустой
PASS clean: второй прогон идемпотентен (схема)
PASS clean: второй прогон не изменил данные
PASS dirty: 4 запуска ensure* без исключений
PASS dirty: избранное не удалено (5 строк до и после) — before=5 after1=5 after2=5
PASS dirty: пользователь не удалён
PASS dirty: проблемные строки сохранены как есть
PASS dirty: PRIMARY KEY не создан при дубликатах/NULL
PASS dirty: FOREIGN KEY не создан при сиротах
PASS dirty: created_at добавлена в users
PASS dirty: предупреждение о NULL-строках с количеством
PASS dirty: предупреждение о дубликатах с количеством
PASS dirty: предупреждение о сиротах с количеством
PASS dirty: второй прогон идемпотентен (схема)
PASS dirty: второй прогон не изменил данные
ИТОГ: все проверки пройдены
```

ESLint по изменённым файлам: чисто
(`cd backend && npx eslint services/poolBD.js services/ensureFavoritesSchema.js services/ensureUsersSchema.js`).

Артефакты: `test/tmp/06-schema-check.json`, `test/tmp/06-schema-clean.json`,
`test/tmp/06-schema-dirty.json` — только агрегаты и имена ограничений, секретов нет.

## Принятые решения (там, где был выбор)

1. Проверка имени тестовой БД — по `pathname` URL, регистронезависимо; нераспознанный URL
   считается ошибкой (а не «пропускаем проверку»).
2. NULL-строки, дубликаты и сироты **никогда** не удаляются: шаг просто пропускается,
   в лог пишется количество.
3. При наличии «чужого» PK шаг PK пропускается (второй PK невозможен) — вместо пересоздания
   таблицы или удаления ограничения.
4. Существующий FK на `users(idusers)` без `ON DELETE CASCADE` не пересоздаётся —
   только предупреждение: не менять чужие ограничения безопаснее.
5. Отдельные DDL-шаги выполняются под `SAVEPOINT`, чтобы одна неудача не откатывала
   всю подготовку схемы и не мешала остальным шагам.
6. Ошибка транзакции пробрасывается в `server.js` (он уже логирует и продолжает старт) —
   дублирующего лога нет, поведение старта сохранено.
7. `server.js` не менялся: существующей обработки ошибок достаточно.
8. `SET NOT NULL` пропускается, если колонка уже `NOT NULL` (не сканируем таблицу на каждом старте).

## Ограничения

- Создание/удаление тестовых баз требует у роли из `secrets/.env` права `CREATEDB`;
  если права нет, скрипт упадёт с сообщением без секретов.
- `users` создаётся по минимальной схеме из README; в рабочей базе таблица уже существует,
  поэтому `CREATE TABLE IF NOT EXISTS` ничего не меняет.
- Данные в сценарии `dirty` — синтетические (1 пользователь, 5 строк избранного).

