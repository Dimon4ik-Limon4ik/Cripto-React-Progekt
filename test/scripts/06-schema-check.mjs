// Проверка подготовки схемы БД (этап 6).
// Работает только с тестовыми базами: имена содержат "test", рабочая
// my_crypto не используется. Секреты не выводятся и в артефакты не попадают.
// Запуск из корня проекта: node test/scripts/06-schema-check.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(MODULE_PATH), "..", "..");
const ENV_PATH = path.join(ROOT, "secrets", ".env");
const TMP_DIR = path.join(ROOT, "test", "tmp");
const RESULT_JSON = path.join(TMP_DIR, "06-schema-check.json");
const TEST_DB = "crypto_app_test";
const DIRTY_DB = "crypto_app_test_dirty";

function backendModulePath(relativePath) {
  return pathToFileURL(path.join(ROOT, "backend", relativePath)).href;
}

async function loadDotenv() {
  const module = await import(backendModulePath("node_modules/dotenv/lib/main.js"));
  return module.default;
}

async function loadPg() {
  const module = await import(backendModulePath("node_modules/pg/lib/index.js"));
  return module.default;
}

// Значения в secrets/.env могут быть в кавычках и с точкой с запятой.
function cleanEnvValue(value) {
  let result = String(value ?? "").trim();

  if (
    result.length >= 2 &&
    (result[0] === '"' || result[0] === "'") &&
    result[result.length - 1] === result[0]
  ) {
    result = result.slice(1, -1);
  }

  if (result.endsWith(";")) {
    result = result.slice(0, -1);
  }

  return result || undefined;
}

function buildUrl({ user, password, host, port, database }) {
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@${host}:${port}/${database}`;
}

// Пересоздаём только базы с "test" в имени: пустая база на каждый прогон.
async function recreateDatabase(admin, name) {
  if (!name.toLowerCase().includes("test")) {
    throw new Error("Отказ: имя тестовой базы должно содержать test");
  }

  await admin.query(
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
    [name],
  );
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.query(`CREATE DATABASE "${name}"`);
}

async function scalar(pool, sql) {
  try {
    const result = await pool.query(sql);
    return Number(result.rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

async function tableExists(pool, name) {
  const result = await pool.query("SELECT to_regclass($1) AS name", [name]);
  return Boolean(result.rows[0]?.name);
}

// Только агрегаты: ни одной строки пользовательских данных не читаем целиком.
async function snapshot(pool) {
  return {
    users: await scalar(pool, "SELECT count(*) AS count FROM users"),
    favorites: await scalar(
      pool,
      "SELECT count(*) AS count FROM cryptoinfavorites",
    ),
    nullOwners: await scalar(
      pool,
      "SELECT count(*) AS count FROM cryptoinfavorites WHERE idusers IS NULL",
    ),
    nullCoins: await scalar(
      pool,
      "SELECT count(*) AS count FROM cryptoinfavorites WHERE idcrypto IS NULL",
    ),
    duplicatePairs: await scalar(
      pool,
      `SELECT COALESCE(sum(duplicated.count - 1), 0) AS count
       FROM (
         SELECT count(*) AS count
         FROM cryptoinfavorites
         WHERE idusers IS NOT NULL AND idcrypto IS NOT NULL
         GROUP BY idusers, idcrypto
         HAVING count(*) > 1
       ) duplicated`,
    ),
    orphanFavorites: await scalar(
      pool,
      `SELECT count(*) AS count
       FROM cryptoinfavorites favorites
       WHERE favorites.idusers IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM users WHERE users.idusers = favorites.idusers
         )`,
    ),
  };
}

async function schemaState(pool) {
  if (!(await tableExists(pool, "cryptoinfavorites"))) {
    return { favoritesTable: false };
  }

  const favoritesColumns = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'cryptoinfavorites'
     ORDER BY ordinal_position`,
  );
  const usersColumns = await pool.query(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = current_schema() AND table_name = 'users'
     ORDER BY ordinal_position`,
  );
  const primaryKeys = await pool.query(
    `SELECT c.conname AS name,
            array_agg(a.attname::text ORDER BY a.attname::text) AS columns
     FROM pg_constraint c
     JOIN pg_attribute a
       ON a.attrelid = c.conrelid
      AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = 'cryptoinfavorites'::regclass
       AND c.contype = 'p'
     GROUP BY c.conname`,
  );
  const foreignKeys = await pool.query(
    `SELECT c.conname AS name,
            c.confrelid::regclass::text AS ref_table,
            c.confdeltype AS delete_action,
            (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
               FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attnum = ANY (c.conkey)) AS columns,
            (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
               FROM pg_attribute a
              WHERE a.attrelid = c.confrelid
                AND a.attnum = ANY (c.confkey)) AS ref_columns
     FROM pg_constraint c
     WHERE c.conrelid = 'cryptoinfavorites'::regclass
       AND c.contype = 'f'`,
  );

  return {
    favoritesTable: true,
    favoritesColumns: favoritesColumns.rows,
    usersColumns: usersColumns.rows,
    primaryKeys: primaryKeys.rows,
    foreignKeys: foreignKeys.rows,
  };
}

async function runWorker() {
  const scenario = process.argv[3];
  const outFile = process.argv[4];
  const { pool } = await import(backendModulePath("services/poolBD.js"));
  const { default: ensureUsersSchema } = await import(
    backendModulePath("services/ensureUsersSchema.js")
  );
  const { default: ensureFavoritesSchema } = await import(
    backendModulePath("services/ensureFavoritesSchema.js")
  );

  const warnings = [];
  const result = { scenario, warnings, steps: [] };
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.map(String).join(" "));

  const record = async (name, action) => {
    try {
      await action();
      result.steps.push({ name, ok: true });
    } catch (error) {
      result.steps.push({ name, ok: false, error: error.message });
    }
  };

  try {
    if (scenario === "dirty") {
      // Унаследованная схема: nullable-колонки, дубликаты, сирота.
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          idusers SERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL,
          login VARCHAR(15) NOT NULL UNIQUE,
          password VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL UNIQUE
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cryptoinfavorites (
          idusers INTEGER,
          idcrypto VARCHAR(100)
        )
      `);
      await pool.query(
        "INSERT INTO users (name, login, password, email) VALUES ($1, $2, $3, $4)",
        ["Legacy User", "legacy01", "legacy-hash", "legacy@example.test"],
      );
      await pool.query(
        `INSERT INTO cryptoinfavorites (idusers, idcrypto)
         VALUES (1, 'bitcoin'), (1, 'bitcoin'), (NULL, 'ethereum'), (1, NULL), (999, 'solana')`,
      );
    }

    result.before = await snapshot(pool);
    await record("ensureUsersSchema #1", ensureUsersSchema);
    await record("ensureFavoritesSchema #1", ensureFavoritesSchema);
    result.afterFirstRun = await snapshot(pool);
    result.schemaAfterFirstRun = await schemaState(pool);

    await record("ensureUsersSchema #2", ensureUsersSchema);
    await record("ensureFavoritesSchema #2", ensureFavoritesSchema);
    result.afterSecondRun = await snapshot(pool);
    result.schemaAfterSecondRun = await schemaState(pool);
  } catch (error) {
    result.fatal = error.message;
  } finally {
    console.warn = originalWarn;
    await pool.end();
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");
  }
}

function runScenario(scenario, database, connection) {
  const outFile = path.join(TMP_DIR, `06-schema-${scenario}.json`);
  const url = buildUrl({ ...connection, database });
  const child = spawnSync(
    process.execPath,
    [MODULE_PATH, "--worker", scenario, outFile],
    {
      cwd: ROOT,
      env: { ...process.env, NODE_ENV: "test", DATABASE_URL_TEST: url },
      encoding: "utf8",
    },
  );

  if (child.status !== 0) {
    throw new Error(`Сценарий ${scenario} завершился с кодом ${child.status}`);
  }

  return JSON.parse(fs.readFileSync(outFile, "utf8"));
}



function jsonEquals(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function columnMap(columns) {
  return new Map((columns ?? []).map((column) => [column.column_name, column]));
}

function evaluate(results) {
  const checks = [];
  const add = (name, ok, detail = "") =>
    checks.push({ name, ok: Boolean(ok), detail });

  const clean = results.clean;
  const dirty = results.dirty;
  const failedSteps = (run) =>
    run.steps
      .filter((step) => !step.ok)
      .map((step) => step.error)
      .join("; ");

  add(
    "clean: 4 запуска ensure* без исключений",
    clean.steps.every((step) => step.ok),
    failedSteps(clean),
  );
  add(
    "clean: предупреждений нет",
    clean.warnings.length === 0,
    clean.warnings.join(" | "),
  );

  const users = columnMap(clean.schemaAfterFirstRun?.usersColumns);
  add(
    "clean: users создана с колонками idusers/name/login/password/email/created_at",
    ["idusers", "name", "login", "password", "email", "created_at"].every(
      (column) => users.has(column),
    ),
    [...users.keys()].join(", "),
  );
  add(
    "clean: users.created_at NOT NULL",
    users.get("created_at")?.is_nullable === "NO",
  );

  const favorites = columnMap(clean.schemaAfterFirstRun?.favoritesColumns);
  add(
    "clean: cryptoinfavorites содержит idusers/idcrypto/created_at",
    ["idusers", "idcrypto", "created_at"].every((column) =>
      favorites.has(column),
    ),
    [...favorites.keys()].join(", "),
  );
  add(
    "clean: idusers/idcrypto NOT NULL",
    favorites.get("idusers")?.is_nullable === "NO" &&
      favorites.get("idcrypto")?.is_nullable === "NO",
  );

  const primaryKeys = clean.schemaAfterFirstRun?.primaryKeys ?? [];
  add(
    "clean: PRIMARY KEY (idusers, idcrypto) создан",
    primaryKeys.some((key) => jsonEquals(key.columns, ["idcrypto", "idusers"])),
    JSON.stringify(primaryKeys),
  );

  const foreignKeys = clean.schemaAfterFirstRun?.foreignKeys ?? [];
  const cascadeKey = foreignKeys.find(
    (key) =>
      jsonEquals(key.columns, ["idusers"]) &&
      String(key.ref_table).split(".").pop() === "users" &&
      jsonEquals(key.ref_columns, ["idusers"]) &&
      key.delete_action === "c",
  );
  add(
    "clean: FOREIGN KEY (idusers) REFERENCES users ON DELETE CASCADE создан",
    Boolean(cascadeKey),
    JSON.stringify(foreignKeys),
  );

  add(
    "clean: пустая база осталась пустой",
    clean.afterFirstRun?.users === 0 && clean.afterFirstRun?.favorites === 0,
    JSON.stringify(clean.afterFirstRun),
  );
  add(
    "clean: второй прогон идемпотентен (схема)",
    jsonEquals(clean.schemaAfterFirstRun, clean.schemaAfterSecondRun),
  );
  add(
    "clean: второй прогон не изменил данные",
    jsonEquals(clean.afterFirstRun, clean.afterSecondRun),
  );

  add(
    "dirty: 4 запуска ensure* без исключений",
    dirty.steps.every((step) => step.ok),
    failedSteps(dirty),
  );

  const before = dirty.before ?? {};
  const afterFirst = dirty.afterFirstRun ?? {};
  const afterSecond = dirty.afterSecondRun ?? {};

  add(
    "dirty: избранное не удалено (5 строк до и после)",
    before.favorites === 5 &&
      afterFirst.favorites === 5 &&
      afterSecond.favorites === 5,
    `before=${before.favorites} after1=${afterFirst.favorites} after2=${afterSecond.favorites}`,
  );
  add(
    "dirty: пользователь не удалён",
    before.users === 1 && afterSecond.users === 1,
  );
  add(
    "dirty: проблемные строки сохранены как есть",
    afterFirst.nullOwners === 1 &&
      afterFirst.nullCoins === 1 &&
      afterFirst.duplicatePairs === 1 &&
      afterFirst.orphanFavorites === 1,
    JSON.stringify(afterFirst),
  );

  const dirtySchema = dirty.schemaAfterFirstRun ?? {};
  add(
    "dirty: PRIMARY KEY не создан при дубликатах/NULL",
    (dirtySchema.primaryKeys ?? []).length === 0,
  );
  add(
    "dirty: FOREIGN KEY не создан при сиротах",
    (dirtySchema.foreignKeys ?? []).length === 0,
  );
  add(
    "dirty: created_at добавлена в users",
    columnMap(dirtySchema.usersColumns).has("created_at"),
  );

  const warningText = (dirty.warnings ?? []).join(" | ");
  add(
    "dirty: предупреждение о NULL-строках с количеством",
    warningText.includes("строк с NULL — 1"),
  );
  add(
    "dirty: предупреждение о дубликатах с количеством",
    warningText.includes("дубликатов пар — 1"),
  );
  add(
    "dirty: предупреждение о сиротах с количеством",
    warningText.includes("несуществующим пользователем — 1"),
  );

  add(
    "dirty: второй прогон идемпотентен (схема)",
    jsonEquals(dirty.schemaAfterFirstRun, dirty.schemaAfterSecondRun),
  );
  add(
    "dirty: второй прогон не изменил данные",
    jsonEquals(afterFirst, afterSecond),
  );

  return checks;
}

async function main() {
  const dotenv = await loadDotenv();
  dotenv.config({ path: ENV_PATH, quiet: true });

  const pg = await loadPg();
  const connection = {
    user: cleanEnvValue(process.env.UserBD),
    password: cleanEnvValue(process.env.passwordBD),
    host: "localhost",
    port: 5432,
  };

  if (!connection.user || !connection.password) {
    throw new Error("В secrets/.env не найдены UserBD/passwordBD");
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });

  // Служебная база postgres — только для CREATE/DROP тестовых баз.
  const admin = new pg.Client({ ...connection, database: "postgres" });
  await admin.connect();

  try {
    await recreateDatabase(admin, TEST_DB);
    await recreateDatabase(admin, DIRTY_DB);
  } finally {
    await admin.end();
  }

  const results = {
    clean: runScenario("clean", TEST_DB, connection),
    dirty: runScenario("dirty", DIRTY_DB, connection),
  };
  const checks = evaluate(results);

  fs.writeFileSync(
    RESULT_JSON,
    JSON.stringify(
      { createdAt: new Date().toISOString(), results, checks },
      null,
      2,
    ),
    "utf8",
  );

  for (const check of checks) {
    const detail = check.detail ? ` — ${check.detail}` : "";
    console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}${detail}`);
  }

  const failed = checks.filter((check) => !check.ok).length;
  console.log(
    failed === 0 ? "ИТОГ: все проверки пройдены" : `ИТОГ: провалено ${failed}`,
  );
  process.exitCode = failed === 0 ? 0 : 1;
}

if (process.argv[2] === "--worker") {
  await runWorker();
} else {
  await main();
}


