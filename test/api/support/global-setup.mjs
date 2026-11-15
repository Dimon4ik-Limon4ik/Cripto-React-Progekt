// globalSetup: поднимает копию БД при необходимости и запускает бэкенд
// в NODE_ENV=test против копии. После прогона останавливает сервер,
// удаляет оставшиеся тестовые аккаунты и пишет сводку в test/tmp.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  API_PORT,
  BACKEND_DIR,
  BASE_URL,
  COPY_DB,
  TMP_DIR,
  databaseUrl,
  dbHost,
  dbPassword,
  dbPort,
  dbUser,
  loadBackendModule,
} from "./env.mjs";
import { closePool, query, scalar } from "./db.mjs";
import { TEST_EMAIL_DOMAIN } from "./helpers.mjs";

const SUMMARY_JSON = path.join(TMP_DIR, "03-api-summary.json");

async function ensureCopyDatabase() {
  const pg = await loadBackendModule("node_modules/pg/lib/index.js");
  const admin = new pg.Client({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: "postgres",
  });

  await admin.connect();

  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      COPY_DB,
    ]);

    if (existing.rowCount === 0) {
      if (!COPY_DB.toLowerCase().includes("test")) {
        throw new Error("Отказ: имя тестовой базы должно содержать test");
      }
      await admin.query(`CREATE DATABASE "${COPY_DB}"`);
    }
  } finally {
    await admin.end();
  }
}

function startServer() {
  const child = spawn(
    process.execPath,
    [
      "--import",
      pathToFileURL(path.join(import.meta.dirname, "fetch-stub.mjs")).href,
      "server.js",
    ],
    {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL_TEST: databaseUrl,
        PORT: String(API_PORT),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  const schemaLines = [];

  const onData = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (line.includes("[schema]")) {
        schemaLines.push(line.trim());
      }
    }
  };

  child.stdout.on("data", onData);
  child.stderr.on("data", onData);

  return { child, schemaLines };
}

async function waitForServer(timeoutMs = 30_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${BASE_URL}/`);
      if (response.ok) {
        return true;
      }
    } catch {
      // сервер ещё стартует
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill();

  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (!exited) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

export default async function setup({ provide }) {
  if (!databaseUrl.includes("test")) {
    throw new Error("Отказ: API-тесты запускаются только против базы с test в имени");
  }

  fs.mkdirSync(TMP_DIR, { recursive: true });
  await ensureCopyDatabase();

  const { child, schemaLines } = startServer();
  const ready = await waitForServer();

  if (!ready) {
    await stopServer(child);
    throw new Error("Бэкенд не ответил на / за 30 секунд (NODE_ENV=test)");
  }

  // Остатки прерванных прогонов (@vitest.local) удаляем ДО снятия baseline,
  // иначе preserved=false покажет влияние не текущего прогона, а прошлого сбоя.
  const staleBefore = await query("SELECT idusers FROM users WHERE email LIKE $1", [
    `%${TEST_EMAIL_DOMAIN}`,
  ]);
  const staleIds = staleBefore.rows.map((row) => row.idusers);

  if (staleIds.length > 0) {
    await query("DELETE FROM cryptoinfavorites WHERE idusers = ANY($1::int[])", [staleIds]);
    await query("DELETE FROM users WHERE idusers = ANY($1::int[])", [staleIds]);
  }

  const baseline = {
    users: await scalar("SELECT count(*) AS count FROM users"),
    favorites: await scalar("SELECT count(*) AS count FROM cryptoinfavorites"),
  };

  provide({ baseUrl: BASE_URL, baseline });

  const startedAt = Date.now();

  return async () => {
    await stopServer(child);

    const leftover = await query(
      "SELECT idusers FROM users WHERE email LIKE $1",
      [`%${TEST_EMAIL_DOMAIN}`],
    );
    const leftoverIds = leftover.rows.map((row) => row.idusers);

    if (leftoverIds.length > 0) {
      await query("DELETE FROM cryptoinfavorites WHERE idusers = ANY($1::int[])", [
        leftoverIds,
      ]);
      await query("DELETE FROM users WHERE idusers = ANY($1::int[])", [leftoverIds]);
    }

    const final = {
      users: await scalar("SELECT count(*) AS count FROM users"),
      favorites: await scalar("SELECT count(*) AS count FROM cryptoinfavorites"),
    };

    await closePool();

    fs.writeFileSync(
      SUMMARY_JSON,
      JSON.stringify(
        {
          createdAt: new Date().toISOString(),
          durationMs: Date.now() - startedAt,
          baseUrl: BASE_URL,
          database: COPY_DB,
          baseline,
          final,
          preserved: baseline.users === final.users && baseline.favorites === final.favorites,
          leftoverBeforeCleaned: staleIds.length,
          leftoverRemoved: leftoverIds.length,
          schemaLines,
        },
        null,
        2,
      ),
      "utf8",
    );

    // Если тесты изменили существующие данные копии — прогон считается упавшим.
    if (baseline.users !== final.users || baseline.favorites !== final.favorites) {
      throw new Error(
        "Тесты изменили существующие данные копии: " +
          `users ${baseline.users} -> ${final.users}, ` +
          `cryptoinfavorites ${baseline.favorites} -> ${final.favorites}`,
      );
    }
  };
}
