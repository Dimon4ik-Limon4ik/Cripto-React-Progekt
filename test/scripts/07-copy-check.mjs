// Этап 7, шаги 1-2: копия рабочей БД и проверки на копии.
//
// Безопасность:
//  - рабочая база my_crypto используется ТОЛЬКО для pg_dump (чтение);
//  - копия называется my_crypto_copy_test (в имени есть "test");
//  - дамп пишется во временную папку ОС вне проекта и удаляется после restore;
//  - значения секретов (пользователь, пароль, URL, ключи) не печатаются
//    и не пишутся в артефакты; в отчёт попадают только количества.
//
// Запуск из корня проекта: node test/scripts/07-copy-check.mjs
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MODULE_PATH = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(MODULE_PATH), "..", "..");
const ENV_PATH = path.join(ROOT, "secrets", ".env");
const TMP_DIR = path.join(ROOT, "test", "tmp");
const RESULT_JSON = path.join(TMP_DIR, "07-copy-check.json");
const SERVER_LOG = path.join(TMP_DIR, "07-server.log");

const SOURCE_DB = "my_crypto";
const COPY_DB = "my_crypto_copy_test";
const HOST = "localhost";
const PORT = 5432;
const API_PORT = 3107;

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

function buildUrl({ user, password, database }) {
  const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
  return `postgres://${credentials}@${HOST}:${PORT}/${database}`;
}

function assertTestDatabase(name) {
  if (!String(name).toLowerCase().includes("test")) {
    throw new Error("Отказ: операции разрешены только с базой, в имени которой есть test");
  }
}

// Пароль передаём только через env (PGPASSWORD), значения не логируем.
function runPgTool(tool, args, password) {
  const result = spawnSync(tool, args, {
    cwd: ROOT,
    env: { ...process.env, PGPASSWORD: password },
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });

  return {
    status: result.status,
    // stderr не выводим: он может включать фрагменты SQL с данными.
    stderrLines: String(result.stderr ?? "").split(/\r?\n/).filter(Boolean).length,
  };
}

async function recreateCopy(pg, connection) {
  assertTestDatabase(COPY_DB);

  const admin = new pg.Client({ ...connection, database: "postgres" });
  await admin.connect();

  try {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [COPY_DB],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${COPY_DB}"`);
    await admin.query(`CREATE DATABASE "${COPY_DB}"`);
  } finally {
    await admin.end();
  }
}

// Сервер запускается только против копии: NODE_ENV=test + DATABASE_URL_TEST.
function startServer(databaseUrl) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: path.join(ROOT, "backend"),
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL_TEST: databaseUrl,
      PORT: String(API_PORT),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const log = [];
  let ready = false;
  let resolveReady;
  let rejectReady;

  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });

  const onData = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (!line.trim()) {
        continue;
      }

      // В артефакт попадают только стартовые и schema-строки:
      // они не содержат ни данных, ни секретов.
      if (
        line.includes("[schema]") ||
        line.includes("Сервер запущен") ||
        line.startsWith("Не удалось подготовить схему")
      ) {
        log.push(line.trim());
      }

      if (line.includes("Сервер запущен") && !ready) {
        ready = true;
        resolveReady();
      }
    }
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  const timer = setTimeout(() => {
    if (!ready) {
      rejectReady(new Error("Сервер не сообщил о готовности за 30 секунд"));
    }
  }, 30_000);

  child.on("exit", (code) => {
    clearTimeout(timer);
    if (!ready) {
      rejectReady(new Error(`Сервер завершился до готовности (код ${code})`));
    }
  });

  return {
    log,
    ready: readyPromise,
    stop: async () => {
      clearTimeout(timer);
      if (child.exitCode !== null) {
        return;
      }

      child.kill();

      const exited = await Promise.race([
        new Promise((resolve) => child.once("exit", () => resolve(true))),
        new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
      ]);

      if (!exited) {
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      }
    },
  };
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // сервер ещё поднимается
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

async function readStats(pool) {
  const scalar = async (sql) => {
    try {
      const result = await pool.query(sql);
      return Number(result.rows[0]?.count ?? 0);
    } catch (error) {
      return { error: error.code ?? "error" };
    }
  };

  const exists = async (name) => {
    const result = await pool.query("SELECT to_regclass($1) AS name", [name]);
    return Boolean(result.rows[0]?.name);
  };

  const stats = {
    tables: {
      users: await exists("users"),
      cryptoinfavorites: await exists("cryptoinfavorites"),
    },
    usersCount: await scalar("SELECT count(*) AS count FROM users"),
    favoritesCount: await scalar("SELECT count(*) AS count FROM cryptoinfavorites"),
    nullIdusers: await scalar(
      "SELECT count(*) AS count FROM cryptoinfavorites WHERE idusers IS NULL",
    ),
    nullIdcrypto: await scalar(
      "SELECT count(*) AS count FROM cryptoinfavorites WHERE idcrypto IS NULL",
    ),
    duplicatePairs: await scalar(
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
      `SELECT count(*) AS count
       FROM cryptoinfavorites favorites
       WHERE favorites.idusers IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM users WHERE users.idusers = favorites.idusers
         )`,
    ),
    primaryKeys: [],
    foreignKeys: [],
    favoriteColumns: [],
  };

  if (stats.tables.cryptoinfavorites) {
    const columns = await pool.query(
      `SELECT a.attname AS name, a.attnotnull AS not_null
       FROM pg_attribute a
       WHERE a.attrelid = 'cryptoinfavorites'::regclass
         AND a.attnum > 0 AND NOT a.attisdropped
       ORDER BY a.attnum`,
    );
    stats.favoriteColumns = columns.rows.map((row) => ({
      name: row.name,
      notNull: row.not_null,
    }));

    const pks = await pool.query(
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
    stats.primaryKeys = pks.rows;

    const fks = await pool.query(
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
    stats.foreignKeys = fks.rows.map((row) => ({
      name: row.name,
      refTable: String(row.ref_table ?? "").split(".").pop(),
      deleteAction: row.delete_action,
      cascade: row.delete_action === "c",
      columns: row.columns,
      refColumns: row.ref_columns,
    }));
  }

  return stats;
}

async function main() {
  const dotenv = await loadDotenv();
  dotenv.config({ path: ENV_PATH, quiet: true });

  const user = cleanEnvValue(process.env.UserBD);
  const password = cleanEnvValue(process.env.passwordBD);

  if (!user || !password) {
    throw new Error("В secrets/.env не найдены UserBD/passwordBD");
  }

  const pg = await loadPg();
  const connection = { user, password, host: HOST, port: PORT };

  fs.mkdirSync(TMP_DIR, { recursive: true });

  // Дамп — во временную папку ОС, вне проекта и вне git.
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "crypto-stage7-"));
  const dumpPath = path.join(workDir, `${SOURCE_DB}.dump`);

  const result = {
    createdAt: new Date().toISOString(),
    sourceDatabase: SOURCE_DB,
    copyDatabase: COPY_DB,
    dump: { inProject: false, temporary: true, removed: false },
    server: { nodeEnv: "test", started: false, stopped: false, schemaLines: [] },
    before: null,
    after: null,
  };

  try {
    // 1. pg_dump рабочей базы (только чтение).
    const dump = runPgTool(
      "pg_dump",
      ["-h", HOST, "-p", String(PORT), "-U", user, "-d", SOURCE_DB, "-Fc", "-f", dumpPath],
      password,
    );

    if (dump.status !== 0 || !fs.existsSync(dumpPath)) {
      throw new Error(`pg_dump завершился с ошибкой (код ${dump.status})`);
    }

    result.dump.sizeBytes = fs.statSync(dumpPath).size;

    // 2. Пересоздаём копию и восстанавливаем дамп.
    await recreateCopy(pg, connection);

    const restore = runPgTool(
      "pg_restore",
      [
        "-h", HOST,
        "-p", String(PORT),
        "-U", user,
        "-d", COPY_DB,
        "--no-owner",
        "--no-privileges",
        dumpPath,
      ],
      password,
    );

    result.restore = {
      exitCode: restore.status,
      stderrLines: restore.stderrLines,
      ok: restore.status === 0,
    };

    // 3. Статистика копии до запуска сервера.
    const copyUrl = buildUrl({ user, password, database: COPY_DB });
    const db = new pg.Client({ connectionString: copyUrl });
    await db.connect();

    try {
      result.before = await readStats(db);
    } finally {
      await db.end();
    }

    // 4. Запуск бэкенда против копии: NODE_ENV=test + DATABASE_URL_TEST.
    const server = startServer(copyUrl);

    try {
      await server.ready;
      result.server.started = true;
      result.server.httpReady = await waitForHttp(`http://127.0.0.1:${API_PORT}/`);
    } finally {
      await server.stop();
      result.server.stopped = true;
      result.server.schemaLines = server.log.filter((line) => line.includes("[schema]"));
      result.server.startupLines = server.log.filter(
        (line) => !line.includes("[schema]"),
      );
      fs.writeFileSync(SERVER_LOG, `${server.log.join("\n")}\n`, "utf8");
    }

    // 5. Статистика копии после старта (ensure* мог добавить PK/FK).
    const dbAfter = new pg.Client({ connectionString: copyUrl });
    await dbAfter.connect();

    try {
      result.after = await readStats(dbAfter);
    } finally {
      await dbAfter.end();
    }
  } finally {
    // Дамп удаляется сразу после восстановления/проверок.
    try {
      fs.rmSync(workDir, { recursive: true, force: true });
      result.dump.removed = !fs.existsSync(workDir);
    } catch {
      result.dump.removed = false;
    }
  }

  fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2), "utf8");

  console.log("== Шаг 1. Копия базы ==");
  console.log(`pg_dump: OK, размер дампа: ${result.dump.sizeBytes} байт (файл вне проекта)`);
  console.log(
    `pg_restore в ${COPY_DB}: ${result.restore.ok ? "OK" : `ошибка (код ${result.restore.exitCode})`}`,
  );
  console.log(`дамп удалён: ${result.dump.removed ? "да" : "НЕТ"}`);

  console.log("\n== Шаг 2. Проверки на копии ==");
  console.log(
    `бэкенд NODE_ENV=test: запущен=${result.server.started}, http=${result.server.httpReady}, остановлен=${result.server.stopped}`,
  );
  console.log(`строк [schema]: ${result.server.schemaLines.length}`);
  for (const line of result.server.schemaLines) {
    console.log(`  ${line}`);
  }

  const printStats = (label, stats) => {
    if (!stats) {
      console.log(`${label}: нет данных`);
      return;
    }

    console.log(`${label}:`);
    console.log(`  users: ${stats.usersCount}, избранное: ${stats.favoritesCount}`);
    console.log(
      `  NULL idusers: ${stats.nullIdusers}, NULL idcrypto: ${stats.nullIdcrypto}`,
    );
    console.log(`  дубликаты пар (idusers, idcrypto): ${stats.duplicatePairs}`);
    console.log(`  избранное с несуществующим пользователем: ${stats.orphanFavorites}`);
    console.log(
      `  PRIMARY KEY: ${
        stats.primaryKeys.length === 0
          ? "нет"
          : stats.primaryKeys
              .map((pk) => `${pk.name}(${(pk.columns ?? []).join(",")})`)
              .join("; ")
      }`,
    );
    console.log(
      `  FOREIGN KEY: ${
        stats.foreignKeys.length === 0
          ? "нет"
          : stats.foreignKeys
              .map(
                (fk) =>
                  `${fk.name} -> ${fk.refTable}(${(fk.refColumns ?? []).join(",")}) ON DELETE ${
                    fk.cascade ? "CASCADE" : fk.deleteAction
                  }`,
              )
              .join("; ")
      }`,
    );
  };

  printStats("до запуска сервера", result.before);
  printStats("после запуска сервера", result.after);

  console.log(`\nАртефакт: ${path.relative(ROOT, RESULT_JSON)}`);
  console.log(`Лог сервера (только [schema]/старт): ${path.relative(ROOT, SERVER_LOG)}`);
}

await main();

