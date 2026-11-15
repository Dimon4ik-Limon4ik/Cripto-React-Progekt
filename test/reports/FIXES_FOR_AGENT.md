# FIXES_FOR_AGENT — задание на исправление дефектов (этапы 3–4)

Документ — готовое задание для другого ИИ-агента. Все 16 дефектов **воспроизведены**
автотестами из `test/` на копии БД `my_crypto_copy_test`:

- API — Vitest + Supertest (`test/api/`), 13 дефектов на 13 красных тестах;
- UI — Playwright (`test/ui/`), 3 дефекта на 3 красных тестах.

Пункты идут **строго по критичности**: сначала высокая, затем средняя, затем низкая.
В каждом пункте есть: файл и строки, что происходит, как воспроизвести тестом,
что изменить и как проверить.

## Соответствие прежней нумерации

Номера из отчётов `03-api.md` (1–13) и `04-ui.md` (14–16) сохранены только там;
здесь список отсортирован по критичности и перенумерован:

| Было | Стало | Критичность | Тема |
| --- | --- | --- | --- |
| 1 | 1 | высокая | нет rate limiting |
| 2 | 2 | высокая | JWT живёт после смены пароля |
| 3 | 3 | средняя | email > 100 → 500 |
| 4 | 4 | средняя | тело > лимита → 500 вместо 413 |
| 5 | 5 | средняя | нет верхней границы длины login/password при входе |
| 14 | **6** | средняя | главная висит на «Загрузка...» при ошибке котировок |
| 6 | 7 | низкая | email с учётом регистра |
| 7 | 8 | низкая | нет security-заголовков, есть X-Powered-By |
| 8 | 9 | низкая | нет лимита длины coinId в `/crypto/*` |
| 9 | 10 | низкая | 5xx внешнего API как 5xx нашего |
| 10 | 11 | низкая | новый пароль = текущий |
| 11 | 12 | низкая | ПДн и SQL в логах |
| 12 | 13 | низкая | JWT без списка algorithms |
| 13 | 14 | низкая | хрупкое избранное + дублирование CoinGecko |
| 15 | 15 | низкая | нет имени у поля поиска |
| 16 | 16 | низкая | нет имени у кнопки темы |

## Правила для исполнителя (обязательны)

1. **Работать в новой ветке.** Перед правками: `git switch -c fix/api-defects`
   (для UI-части допустима отдельная ветка `fix/ui-defects`). В `main` не коммитить,
   force-push не делать.
2. **Менять только файлы, перечисленные в этом документе.** Ничего не удалять и не
   переименовывать. Файлы вне списка (включая `test/**`, `secrets/**`, lock-файлы) не трогать.
3. **Секреты не выводить.** Не печатать и не коммитить содержимое `secrets/.env`, пароли,
   токены, строки подключения, API-ключи, email/логины реальных пользователей.
   В отчётах — только количества.
4. **Рабочую базу `my_crypto` не трогать.** Не запускать против неё сервер, тесты, миграции,
   `INSERT/UPDATE/DELETE/DDL`. Все проверки — только на копии `my_crypto_copy_test`
   (`NODE_ENV=test` + `DATABASE_URL_TEST` в среде процесса, без `setx` и без записи в файлы).
5. **Данные пользователей не удалять.** В копии разрешено удалять только записи тестовых
   аккаунтов (`@vitest.local`), созданные тестами. Существующие строки
   `users`/`cryptoinfavorites` не изменять.
6. **Тесты из `test/` не ослаблять и не удалять.** Ожидания в `test/api/07-security-gaps.test.js`,
   `test/api/08-limits-and-errors.test.js`, `test/ui/specs/02-home-search.spec.js` и
   `test/ui/specs/07-a11y.spec.js` менять нельзя: после исправлений эти тесты должны стать
   зелёными «как есть». Нельзя добавлять `it.fails`, `skip`, `todo`, `test.fixme` и подменять
   ожидаемые коды/тексты.
7. **После правок запустить тесты из `test/` и показать `git diff`** (команды ниже), приложить вывод.
8. Если правка требует новой зависимости — **сначала согласуйте**; по умолчанию используйте
   решения без новых пакетов (все сниппеты ниже зависимостей не требуют).
9. **Порты 3000/5173 не занимать и не останавливать:** это dev-серверы разработчика.
   UI-тесты сами поднимают бэкенд на 3104 и Vite на 5174.

## Команды проверки (Windows, из корня проекта)

```bash
# 0. Ветка
git switch -c fix/api-defects

# 1. Копия рабочей БД (только если её нет; существующая не пересоздаётся)
node test/scripts/03-ensure-copy.mjs

# 2. Все тесты одной командой: API (Vitest), затем UI (Playwright)
cd test
npm run test:all

# 3. Быстрая проверка только «дефектных» тестов
npx vitest run --config api/vitest.config.mjs 07-security-gaps 08-limits
npx vitest run --config api/vitest.config.mjs 04-profile 05-favorites 06-crypto
npx playwright test --config ui/playwright.config.mjs 02-home-search 07-a11y

# 4. Проверка области на секреты и ПДн (значения не печатаются)
npm run scan:secrets

# 5. Показать изменения
cd ..
git --no-pager diff
git status --short
```

**Сейчас:** API `13 failed | 133 passed (146)`, UI `3 failed | 41 passed (44)`.
**Ожидаемый результат после всех правок:** API `0 failed | 146 passed (146)`,
UI `0 failed | 44 passed (44)`; `test/tmp/03-api-summary.json` и
`test/tmp/04-ui-summary.json` — `"preserved": true`, количества `users`/`cryptoinfavorites`
те же, что до прогона.

---

## 1. ВЫСОКАЯ — нет ограничения частоты попыток входа и регистрации

**Где:** `backend/server.js:48` (после JSON-парсера нет лимитера), `backend/routes/Router.js:13-14`.

**Что происходит:** `POST /auth/login` и `POST /auth/addUsers` вызываются без ограничений.
20 неверных паролей подряд дают 20× `401` — брутфорс и перебор логинов/email не ограничены;
каждая попытка входа ещё и нагружает bcrypt.

**Как воспроизвести:**

```bash
cd test
npx vitest run --config api/vitest.config.mjs 07-security-gaps
```

Тест `после серии неверных паролей должен появиться 429` получает `[401 × 20]` вместо `429`.

**Что изменить (без новых зависимостей):**

Создайте `backend/middleware/rateLimit.js`:

```js
// Простой in-memory лимитер: ключ -> { count, resetAt }.
const attempts = new Map();
const MAX_KEYS = 10_000;

const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    if (entry.resetAt <= now) {
      attempts.delete(key);
    }
  }
}, 60_000);
// Таймер не должен держать процесс живым (важно для тестов).
cleanup.unref?.();

export default function rateLimit({ windowMs, max, keyOf, message }) {
  return function rateLimitMiddleware(req, res, next) {
    const key = keyOf(req);
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || entry.resetAt <= now) {
      if (attempts.size >= MAX_KEYS) {
        attempts.clear(); // безопасная деградация: сброс счётчиков
      }
      attempts.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;

    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}
```

В `backend/routes/Router.js` (после `import`-ов, перед объявлением маршрутов):

```js
import rateLimit from "../middleware/rateLimit.js";

// Ключ обязательно включает логин/email: иначе тесты (и реальные пользователи)
// с уникальными логинами мешали бы друг другу при общем IP.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyOf: (req) =>
    `login:${req.ip}:${String(req.body?.login ?? "").slice(0, 50).toLowerCase()}`,
  message: "Слишком много попыток входа. Попробуйте позже",
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyOf: (req) =>
    `reg:${req.ip}:${String(req.body?.email ?? "").slice(0, 100).toLowerCase()}`,
  message: "Слишком много попыток регистрации. Попробуйте позже",
});

router.post("/addUsers", registerRateLimit, validateRegister, registerUser);
router.post("/login", loginRateLimit, validateLogin, loginUser);
```

**Проверка:** тест `после серии неверных паролей должен появиться 429` зелёный;
`03-auth-login-token.test.js` (23 теста) и `09-ownership-and-403.test.js` (23 теста) без падений
(в них у каждого теста уникальный логин, поэтому лимит не срабатывает).

---

## 2. ВЫСОКАЯ — JWT остаётся валидным после смены пароля

**Где:** `backend/middleware/TokenCheck.js:14-19, 26-35`, `backend/controllers/changePassword.js:27-32`,
`backend/services/CreateJWTtoken.js:4` (срок 30 дней).

**Что происходит:** после `PATCH /auth/changePassword` старый токен продолжает давать доступ 30 дней.
Украденный токен невозможно отозвать сменой пароля — стандартный сценарий восстановления аккаунта
не работает. Дополнительно `PATCH` не возвращает новый токен, поэтому клиент остаётся «в сессии».

**Как воспроизвести:** `test/api/07-security-gaps.test.js` →
`токен, выданный до смены пароля, должен становиться недействительным`
(сейчас `GET /auth/profile` со старым токеном отвечает **200**, ожидается **401**).

**Что изменить:**

1. `backend/services/ensureUsersSchema.js` — идемпотентно добавить колонку (NULL = пароль не менялся,
   поэтому существующие токены не отзываются массово):

```js
await pool.query(`
  ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ
`);
```

2. `backend/controllers/changePassword.js:29-32` — фиксировать момент смены:

```js
await pool.query(
  "UPDATE users SET password = $1, password_changed_at = NOW() WHERE idusers = $2",
  [passwordHash, req.user.userId],
);
```

3. `backend/middleware/TokenCheck.js:26-35` — сравнивать `iat` токена с `password_changed_at`:

```js
const result = await pool.query(
  "SELECT password_changed_at FROM users WHERE idusers = $1 LIMIT 1",
  [decoded.userId],
);
const user = result.rows[0];

if (!user) {
  return res.status(401).json({ error: "Пользователь не найден" });
}

const changedAt = user.password_changed_at
  ? new Date(user.password_changed_at).getTime()
  : 0;

// iat — в секундах; токен, выпущенный до смены пароля, больше не действует.
if (changedAt > 0 && typeof decoded.iat === "number" && decoded.iat * 1000 < changedAt) {
  return res.status(401).json({ error: "Сессия устарела. Войдите снова" });
}
```

**Проверка:** тест из п.2 зелёный; `04-profile-and-account.test.js` (11 тестов) без падений,
включая «200: пароль меняется, старый перестаёт работать» (проверяется через `/auth/login`, не токеном).

**Замечание по UX (выбран безопасный вариант):** после смены пароля клиент должен войти заново.
Возврат нового токена из `changePassword` потребовал бы правок в `src/` — это вне списка файлов
задания, поэтому по умолчанию только backend.

---

## 3. СРЕДНЯЯ — email длиннее 100 символов даёт 500 вместо 400

**Где:** `backend/middleware/validateRegister.js:1` (`EMAIL_PATTERN` без ограничения длины),
`:14` (`email = data.email.trim()`), `:32-34`; схема: `users.email VARCHAR(100)`
(см. `test/tmp/03-schema.json`).

**Что происходит:** валидатор проверяет только формат email. Email длиной 101–300 символов проходит
проверку, `INSERT` падает с `22001` (`value too long for type character varying(100)`),
контроллер `addUsers.js:15-25` ловит только `23505` и отвечает **500 «Не удалось создать аккаунт»**.
Пользователь видит «ошибку сервера» вместо подсказки, а сервер зря логирует ошибку БД.

**Как воспроизвести:** `test/api/08-limits-and-errors.test.js` → три теста
`email длиной 101/255/300 должен отклоняться с 400, а не падать в 500` (сейчас 500).
Контрольный тест `email ровно 100 символов принимается` зелёный — значит, дело именно в длине.

**Что изменить:** `backend/middleware/validateRegister.js` — после проверки формата (строки 32-34):

```js
// users.email в рабочей БД — VARCHAR(100). Без этой проверки INSERT падает
// с 22001 и эндпоинт отвечает 500 вместо 400.
const EMAIL_MAX_LENGTH = 100;

if (email.length > EMAIL_MAX_LENGTH) {
  return res
    .status(400)
    .json({ error: `Email должен содержать не более ${EMAIL_MAX_LENGTH} символов` });
}
```

**Не** расширяйте колонку через `ALTER TABLE`: это DDL на рабочей БД (правило 4) и выход за список
файлов. Лимит 100 работает и на схеме `VARCHAR(255)`.

**Проверка:** три теста из п.3 зелёные, контрольный тест со 100 символами остаётся зелёным,
`02-auth-registration.test.js` (26 тестов) без падений.

---

## 4. СРЕДНЯЯ — тело больше лимита даёт 500 вместо 413

**Где:** `backend/server.js:48` (`express.json()` с лимитом по умолчанию 100 КБ),
`backend/server.js:62-71` (обработчик ошибок).

**Что происходит:** `express.json()` отклоняет тело >100 КБ ошибкой `type: "entity.too.large"`
и `status: 413`, но обработчик знает только `entity.parse.failed` и отвечает
**500 «Внутренняя ошибка сервера»** плюс пишет ошибку в лог.

**Как воспроизвести:** `07-security-gaps.test.js` → `тело больше лимита должно давать 413, а не 500`
(отправляется ~200 КБ JSON).

**Что изменить:** `backend/server.js:64-71`:

```js
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Некорректный JSON в запросе" });
  }

  if (err?.type === "entity.too.large") {
    return res.status(413).json({ error: "Слишком большой запрос" });
  }

  const status = Number(err?.status ?? err?.statusCode ?? 500);
  if (status >= 400 && status < 500) {
    return res.status(status).json({ error: "Некорректный запрос" });
  }

  console.error("Необработанная ошибка сервера:", err.code ?? err.message);
  return res.status(500).json({ error: "Внутренняя ошибка сервера" });
});
```

**Проверка:** тест из п.4 зелёный; `01-routing-and-errors.test.js` (9 тестов) — битый JSON
по-прежнему `400`, ответы без стека.

---

## 5. СРЕДНЯЯ — нет верхней границы длины login/password при входе

**Где:** `backend/middleware/validateLogin.js:4-12`, `backend/controllers/login.js:8-11`.

**Что происходит:** при входе проверяется только «непустая строка». Логин/пароль длиной 5000 символов
доходят до `pool.query` и `bcrypt.compare`, ответ — `401` вместо `400`. Расхождение с регистрацией
(там 6–15 символов) и лишняя нагрузка на БД/bcrypt при массовых запросах (усиливается дефектом №1).

**Как воспроизвести:** `07-security-gaps.test.js` →
`слишком длинные login/password должны отклоняться с 400` (сейчас `401`).

**Что изменить:** `backend/middleware/validateLogin.js` — после проверки на пустоту (строка 11):

```js
const LOGIN_MAX_LENGTH = 15;   // как при регистрации
const PASSWORD_MAX_LENGTH = 72; // предел bcrypt в байтах

if (login.trim().length > LOGIN_MAX_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
  return res.status(400).json({ error: "Слишком длинный логин или пароль" });
}
```

**Проверка:** тест из п.5 зелёный; `03-auth-login-token.test.js` (23 теста) — вход с корректными
данными по-прежнему `200`.

---

## 6. СРЕДНЯЯ — при ошибке загрузки котировок главная навсегда показывает «Загрузка...»

**Где:** `src/Services/Services.js:5-30` (`getCryptoMarkets` глотает ошибку и возвращает `[]`),
`src/BackgroundLayout.jsx:35-55` (нет состояния ошибки и повтора),
`src/componets/HomePage/HomePage.jsx:47-63` (пустой список трактуется как «Загрузка...»).

**Что происходит:** если `/crypto/markets` отвечает `502`/`429` или сеть недоступна,
`getCryptoMarkets` логирует ошибку и возвращает пустой массив. `HomePage` считает пустой массив
«ещё грузится» и вечно показывает «Загрузка...». Опрос раз в 3 секунды продолжается, но
пользователь не понимает, что произошло, и не может повторить запрос.

**Как воспроизвести:**

```bash
cd test
npx playwright test --config ui/playwright.config.mjs 02-home-search
```

Тест `дефект: при ошибке загрузки котировок нужен понятный статус и повтор` подменяет
`/crypto/markets` на `502` и ждёт сообщение об ошибке/кнопку «Повторить» — их нет.

**Что изменить (минимально, без изменения `CriptoContext`):**

1. `src/Services/Services.js` — дать возможность узнать об ошибке:

```js
export async function getCryptoMarkets(options = {}) {
  try {
    // ... существующий код ...
    return data;
  } catch (err) {
    console.log(`В файле "Services.js" ошибка: ${err}`);
    if (options.rethrow) throw err;
    return [];
  }
}
```

2. `src/BackgroundLayout.jsx` — состояние ошибки + повтор:

```js
const [cryptoStatus, setCryptoStatus] = useState("loading");

const loadCrypto = async () => {
  try {
    const crypto = await getCryptoMarkets({ rethrow: true });

    if (!cancelled && Array.isArray(crypto) && crypto.length > 0) {
      setArrayOfCryptocurrencies(crypto);
      setCryptoStatus("ready");
    }
  } catch {
    // Пустой ответ не затирает уже загруженные данные.
    if (!cancelled) {
      setCryptoStatus((prev) => (prev === "ready" ? "ready" : "error"));
    }
  }
};

const reloadCrypto = () => {
  setCryptoStatus("loading");
  loadCrypto();
};
```

и передать на главную: `<HomePage status={cryptoStatus} onRetry={reloadCrypto} />`.

3. `src/componets/HomePage/HomePage.jsx` — вместо «Загрузка...» при `status === "error"`:

```jsx
{status === "error" ? (
  <div className="pageConten">
    <p>Не удалось загрузить котировки.</p>
    <button type="button" className="portfolioEmptyBtn" onClick={onRetry}>
      Повторить
    </button>
  </div>
) : (
  <p>Загрузка...</p>
)}
```

**Не** меняйте `CriptoContext` на объект: его потребители (`CoinPage`, `Portfolio`,
`TopGainersTicker`, `TopLosersTicker`) ожидают массив — иначе понадобится правка ещё
четырёх файлов вне списка задания.

**Проверка:** тест из п.6 зелёный; остальные 5 тестов `02-home-search.spec.js` (карточки, поиск,
бегущие строки, клики) остаются зелёными.

---

## 7. НИЗКАЯ — email сравнивается с учётом регистра (дубликаты аккаунтов)

**Где:** `backend/middleware/validateRegister.js:12-14` (только `trim`), `:43` (`req.body`),
`backend/services/addUsersToBD.js:7-10` (INSERT), ограничение `users_email_key` — обычный UNIQUE.

**Что происходит:** `Ivan@…` и `ivan@…` считаются разными адресами, поэтому один человек может
создать два аккаунта с «одним» email. Дефект заметен и в UI: пользователь не понимает, почему
регистрация с тем же адресом в другом регистре проходит.

**Как воспроизвести:** `08-limits-and-errors.test.js` →
`повторная регистрация с тем же email в другом регистре должна давать 409` (сейчас `201`).

**Что изменить:** `backend/middleware/validateRegister.js:14` — нормализовать email к нижнему регистру
до записи в `req.body`:

```js
const email = data.email.trim().toLowerCase();
```

Этого достаточно: UNIQUE-индекс `users_email_key` начнёт отсекать регистровые дубликаты и контроллер
`addUsers.js:17-21` вернёт `409`. DDL (`CREATE UNIQUE INDEX ... lower(email)`) не нужен и запрещён
правилом 4.

**Важно:** старые строки с заглавными буквами остаются как есть — их не переписывать (правило 5).
Вход выполняется по логину, а не по email, поэтому поведение логина не меняется.

**Проверка:** тест из п.7 зелёный; `02-auth-registration.test.js` (26 тестов) без падений
(в том числе `409 при повторном email` и инъекции в email).

---

## 8. НИЗКАЯ — нет защитных HTTP-заголовков и лишний X-Powered-By

**Где:** `backend/server.js:14` (`const app = express()`), `backend/server.js:27-46`
(единственный middleware — CORS), `backend/server.js:48`.

**Что происходит:** ответы не содержат `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, CSP, зато отдают `X-Powered-By: Express` — бесплатный признак стека
для сканеров. Для JSON-API риск умеренный, но это базовый минимум.

**Как воспроизвести:**
`07-security-gaps.test.js` → `GET / должен отдавать базовые security-заголовки`;
`08-limits-and-errors.test.js` → `ответы не должны содержать X-Powered-By`.

**Что изменить:** `backend/server.js`:

```js
const app = express();
app.disable("x-powered-by");
```

и перед `app.use(express.json())` (строка 48) добавить:

```js
// Базовые защитные заголовки без внешних зависимостей (helmet не требуется).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  next();
});
```

**Проверка:** оба теста зелёные; `01-routing-and-errors.test.js` — CORS и preflight (`204`) не сломаны,
`Access-Control-*` не меняются.

---

## 9. НИЗКАЯ — в `/crypto/*` нет ограничения длины coinId

**Где:** `backend/controllers/getCryptoById.js:4-8`, `backend/controllers/getCryptoMarketChart.js:4-13`.

**Что происходит:** `coinId` из пути попадает в URL внешнего API без ограничения длины. `/favorites`
такой лимит имеет (`validateFavoriteCoin.js:2`, 100 символов), а публичные прокси-эндпоинты — нет:
`/crypto/coin/<200 символов>` уходит в CoinGecko и отвечает `200` вместо `400`. Это рассогласование
валидации между эндпоинтами и лишние исходящие запросы с мусором.

**Как воспроизвести:** `08-limits-and-errors.test.js` →
`coinId длиннее 100 символов должен отклоняться с 400` (сейчас `200`).

**Что изменить:** в оба контроллера после `const coinId = String(req.params.coinId || "").trim();`:

```js
const COIN_ID_MAX_LENGTH = 100; // как в validateFavoriteCoin.js

if (!coinId || coinId.length > COIN_ID_MAX_LENGTH) {
  return res.status(400).json({ error: "Некорректный идентификатор монеты" });
}
```

**Важно (иначе сломаются зелёные тесты):** не добавляйте проверку по шаблону
`^[a-z0-9][a-z0-9-]{0,99}$`. Тест `06-crypto-proxy.test.js` →
`SQL-инъекция в coinId не даёт 500 и не ломает ответ` ожидает для коротких payload
(`' OR 1=1--`, `1;DROP TABLE users`, `0' UNION SELECT password FROM users--`) ответ `200`
с `null`/`prices`, а не `400`. Ограничьтесь длиной и пустым значением.

**Проверка:** новый тест зелёный; `06-crypto-proxy.test.js` (14 тестов) — все зелёные,
включая инъекции (`200`, `null`/`prices`) и `429`/`502`.

---

## 10. НИЗКАЯ — 5xx внешнего API выглядит как 5xx нашего сервера

**Где:** `backend/controllers/getCryptoMarkets.js:8-12`, `getTopGainers.js:8-12`,
`getTopLosers.js:8-12`, `getCryptoById.js:16-20`, `getCryptoMarketChart.js:21-25`.

**Что происходит:** `res.status(response.status)` пробрасывает статус CoinGecko как есть. При сбое
внешнего сервиса (`500`) клиент получает `500` от нашего API и не может отличить чужую аварию
от собственной ошибки; мониторинг и фронтенд трактуют это одинаково.

**Как воспроизвести:** `08-limits-and-errors.test.js` →
`ошибка CoinGecko 500 должна транслироваться в 502` (сейчас `500`; в заглушке есть `stub-500`).

**Что изменить:** во всех пяти контроллерах заменить блок `if (!response.ok)`:

```js
if (!response.ok) {
  // 429/404 внешнего API пробрасываем как есть, 5xx — как 502 Bad Gateway.
  const status = response.status >= 500 ? 502 : response.status;
  return res.status(status).json({
    error: `Ошибка CoinGecko API: HTTP ${response.status}`,
  });
}
```

**Проверка:** новый тест зелёный; `06-crypto-proxy.test.js` — `429` остаётся `429`,
`502` для битого формата и сетевой ошибки сохраняется.

---

## 11. НИЗКАЯ — новый пароль может совпадать с текущим

**Где:** `backend/controllers/changePassword.js:17-27` (нет сравнения нового пароля с текущим).

**Что происходит:** `PATCH /auth/changePassword` с `newPassword === currentPassword` отвечает `200`
и перезаписывает хеш тем же паролем. Пользователь считает, что «сменил» пароль, хотя фактически
ничего не изменилось; вместе с дефектом №2 это ещё и принудительно разлогинивает все сессии.

**Как воспроизвести:** `08-limits-and-errors.test.js` →
`смена пароля на тот же самый должна отклоняться с 400` (сейчас `200`).

**Что изменить:** `backend/controllers/changePassword.js` — после успешной проверки текущего пароля
(строки 23-25), перед `bcrypt.hash`:

```js
if (await bcrypt.compare(newPassword, user.password)) {
  return res.status(400).json({ error: "Новый пароль совпадает с текущим" });
}
```

**Проверка:** новый тест зелёный; `04-profile-and-account.test.js` (11 тестов) — «200: пароль меняется»
и «чужой id в теле игнорируется» остаются зелёными.

---

## 12. НИЗКАЯ — персональные данные и текст SQL попадают в логи сервера

**Где:** `backend/server.js:69`, `backend/controllers/addUsers.js:23`, `login.js:25`,
`changePassword.js:35`, `addFavorite.js:17`, `backend/middleware/TokenCheck.js:17, 38`,
`getCryptoMarkets.js:22` и остальные `console.error(...)`.

**Что происходит:** объект ошибки печатается целиком. При нарушении UNIQUE PostgreSQL добавляет
`detail` вида `Key (email)=(...) already exists` — в консоль попадают email/логины пользователей
и текст SQL. Это персональные данные и подсказка для атакующего с доступом к логам.

**Как воспроизвести (вручную, автотеста нет):** отправить повторную регистрацию с уже занятым email
и посмотреть консоль сервера: в строке ошибки будет сам email. Тесты этого не проверяют,
поэтому прогон зелёный и после правки.

**Что изменить:** во всех перечисленных местах печатать только код/сообщение:

```js
console.error("Ошибка регистрации:", err.code ?? err.message);
```

**Проверка:** полный прогон остаётся зелёным; в консоли сервера после повторной регистрации
нет email и нет строки `Key (email)=`.

---

## 13. НИЗКАЯ — жёсткая проверка алгоритма JWT

**Где:** `backend/middleware/TokenCheck.js:15`, `backend/services/CreateJWTtoken.js:4`.

**Что происходит:** `jwt.verify(..., SECRET_KEY)` вызывается без `algorithms`. Сейчас
`jsonwebtoken@9` сам отклоняет `alg: none` (тест `401 для токена с alg=none` проходит), но явный
список алгоритмов — требование безопасной конфигурации и защита от будущих регрессий/подмены библиотеки.

**Как воспроизвести:** автотеста-«красного» нет — регрессия видна по коду. Поведение фиксируют
`03-auth-login-token.test.js` (23 теста: подделанная подпись, чужой секрет, `alg=none`, токен без `userId`).

**Что изменить:**

```js
// CreateJWTtoken.js
jwt.sign({ userId: id }, process.env.SECRET_KEY, {
  expiresIn: "30d",
  algorithm: "HS256",
});

// TokenCheck.js
decoded = jwt.verify(authHeader.split(" ")[1], process.env.SECRET_KEY, {
  algorithms: ["HS256"],
});
```

**Не добавляйте** `issuer`/`audience` в `verify`: тесты и клиент выпускают токены без этих полей,
проверка сломает `03-auth-login-token.test.js` (валидные токены и сообщения об ошибках).

**Проверка:** `03-auth-login-token.test.js` — 23 теста зелёные.

---

## 14. НИЗКАЯ — устойчивость избранного к «грязным» базам и дублирование кода CoinGecko

**Где:** `backend/controllers/addFavorite.js:7-12` (зависимость от `ON CONFLICT (idusers, idcrypto)`),
`getCryptoMarkets.js` / `getTopGainers.js` / `getTopLosers.js` / `getCryptoById.js` /
`getCryptoMarketChart.js` (5 копий одного запроса к CoinGecko).

**Что происходит:** если `ensureFavoritesSchema` не смог создать составной PK (NULL/дубликаты — он
пишет `[schema]`-предупреждение и продолжает работу), `INSERT ... ON CONFLICT (idusers, idcrypto)`
падает с `42P10`, и `POST /favorites` всегда отвечает `500`. На текущей копии PK есть, поэтому тесты
проходят и дефект не воспроизводится. Дополнительно логика запроса к CoinGecko размазана по пяти
файлам: любое изменение (заголовки, таймаут, обработка 5xx) нужно вносить пять раз.

**Как воспроизвести:** автотеста нет (на копии PK есть, `[schema]` без предупреждений).
Проверяется прогоном `05-favorites.test.js` (25 тестов) до и после правки.

**Что изменить (без изменения поведения на чистой БД):**

```js
// Добавление без опоры на уникальный индекс.
await pool.query(
  `INSERT INTO cryptoinfavorites (idusers, idcrypto)
   SELECT $1, $2
   WHERE NOT EXISTS (
     SELECT 1 FROM cryptoinfavorites WHERE idusers = $1 AND idcrypto = $2
   )`,
  [req.user.userId, req.favoriteCoinId],
);
```

Запросы к CoinGecko вынести в `backend/services/coinGecko.js` (один `fetch` + единая обработка ошибок,
включая правило «5xx → 502» из п.10), контроллеры оставить тонкими.

**Проверка:** `05-favorites.test.js` (25 тестов) и `06-crypto-proxy.test.js` (14 тестов) зелёные;
`node test/scripts/03-ensure-copy.mjs` и `npm run test:api` — без предупреждений `[schema]`,
`test/tmp/03-api-summary.json` → `"preserved": true`.

---

## 15. НИЗКАЯ — у поля поиска нет доступного имени

**Где:** `src/componets/HomePage/HomePage.jsx:53` (ветка «Загрузка...») и `:70-77` (основная форма).

**Что происходит:** `<input type="text" className="CriptoSearch" />` без `label`, `placeholder`,
`aria-label`. Скринридер объявляет «текстовое поле» без назначения, `toHaveAccessibleName()`
возвращает пустую строку.

**Как воспроизвести:**

```bash
cd test
npx playwright test --config ui/playwright.config.mjs 07-a11y
```

Тест `дефект: поле поиска должно иметь доступное имя`.

**Что изменить:** в обоих местах добавить:

```jsx
<input
  type="search"
  className="CriptoSearch"
  placeholder="Поиск монеты"
  aria-label="Поиск монеты"
  /* value/onChange — как сейчас */
/>
```

**Проверка:** тест из п.15 зелёный; поиск продолжает фильтровать карточки
(`02-home-search.spec.js` → «поиск фильтрует карточки…»).

---

## 16. НИЗКАЯ — у кнопки переключения темы нет доступного имени

**Где:** `src/componets/Head/SunMoon/SunMoon.jsx:11-22` (обе иконки с `alt=""`, нет `title`/`aria-label`).

**Что происходит:** кнопка `btnSunMoon` не имеет доступного имени — скринридер и автотесты видят
безымянную кнопку.

**Как воспроизвести:** `07-a11y.spec.js` →
`дефект: кнопка переключения темы должна иметь доступное имя`.

**Что изменить:**

```jsx
<button
  className={`btnSunMoon ${theme ? "" : "dark"}`}
  onClick={() => toggleTheme()}
  aria-label={theme ? "Включить тёмную тему" : "Включить светлую тему"}
  aria-pressed={!theme}
  title={theme ? "Тёмная тема" : "Светлая тема"}
>
```

**Проверка:** тест из п.16 зелёный; `01-routing.spec.js` → «переключение темы меняет классы каркаса…»
остаётся зелёным.

---

## Порядок выполнения и критерии приёмки

1. Ветка: `git switch -c fix/api-defects` (UI-часть — можно `fix/ui-defects`).
2. Пункты **1–2** (высокая) — закрывают 2 красных API-теста.
3. Пункты **3–5** (средняя, API) — закрывают 5 красных API-тестов.
4. Пункт **6** (средняя, UI) — закрывает 1 красный UI-тест.
5. Пункты **7–14** (низкая, API) — закрывают оставшиеся 6 красных API-тестов
   (пп. 12, 13, 14 без «красных» тестов, но быстрые и полезные).
6. Пункты **15–16** (низкая, UI) — закрывают 2 красных UI-теста.
7. Прогнать и приложить:

```bash
node test/scripts/03-ensure-copy.mjs
cd test
npm run test:all
npm run scan:secrets
cd ..
git --no-pager diff
git status --short
```

**Критерии приёмки:**

- вывод Vitest: **146 passed, 0 failed** (сейчас 133/13);
- вывод Playwright: **44 passed, 0 failed** (сейчас 41/3);
- `test/tmp/03-api-summary.json` и `test/tmp/04-ui-summary.json`: `"preserved": true`,
  `users`/`cryptoinfavorites` те же, что до прогона;
- `test/tmp/03-schema.json` не менялся (никакого DDL в рабочей базе);
- `npm run scan:secrets` → «Критичных находок: 0»;
- в `git status --short` — только файлы `backend/**` и `src/**`, перечисленные в пунктах 1–16;
- `test/**` не изменён (кроме `test/tmp/**`, который в `.gitignore`);
- dev-серверы на портах 3000/5173 не останавливались и не использовались.








