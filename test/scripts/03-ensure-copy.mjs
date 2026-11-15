// Этап 3: гарантировать существование копии БД для API-тестов.
//
// Безопасность:
//  - рабочая база my_crypto читается только через pg_dump (без изменений);
//  - копия называется my_crypto_copy_test (в имени есть "test");
//  - если копия уже существует, она НЕ пересоздаётся (ничего не теряется);
//  - дамп пишется во временную папку ОС вне проекта и удаляется сразу после restore;
//  - значения секретов (пользователь, пароль, URL) не печатаются, только количества.
//
// Запуск из корня проекта: node test/scripts/03-ensure-copy.mjs
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  COPY_DB,
  ROOT,
  dbHost,
  dbPassword,
  dbPort,
  dbUser,
  loadBackendModule,
} from "../api/support/env.mjs";

const SOURCE_DB = "my_crypto";
const RESULT_JSON = path.join(ROOT, "test", "tmp", "03-ensure-copy.json");

function assertTestDatabase(name) {
  if (!String(name).toLowerCase().includes("test")) {
    throw new Error("Отказ: операции разрешены только с базой, в имени которой есть test");
  }
}

function runPgTool(tool, args) {
  // Пароль — только через env процесса, в командную строку не попадает.
  return spawnSync(tool, args, {
    cwd: ROOT,
    env: { ...process.env, PGPASSWORD: dbPassword },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

async function withAdmin(callback) {
  const pg = await loadBackendModule("node_modules/pg/lib/index.js");
  const client = new pg.Client({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: "postgres",
  });

  await client.connect();

  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function counts() {
  const pg = await loadBackendModule("node_modules/pg/lib/index.js");
  const client = new pg.Client({
    user: dbUser,
    password: dbPassword,
    host: dbHost,
    port: dbPort,
    database: COPY_DB,
  });

  await client.connect();

  try {
    const users = await client.query("SELECT count(*)::int AS count FROM users");
    const favorites = await client.query(
      "SELECT count(*)::int AS count FROM cryptoinfavorites",
    );

    return {
      users: users.rows[0].count,
      favorites: favorites.rows[0].count,
      tables: ["users", "cryptoinfavorites"],
    };
  } finally {
    await client.end();
  }
}

async function main() {
  assertTestDatabase(COPY_DB);

  const result = {
    createdAt: new Date().toISOString(),
    copyDb: COPY_DB,
    existedBefore: false,
    createdFromDump: false,
    dumpRemoved: null,
    restoreExitCode: null,
    counts: null,
  };

  const exists = await withAdmin(async (client) => {
    const found = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      COPY_DB,
    ]);
    return found.rowCount > 0;
  });

  result.existedBefore = exists;

  if (!exists) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "crypto-dump-"));
    const dumpFile = path.join(workDir, "my_crypto.dump");

    try {
      const dump = runPgTool("pg_dump", [
        "--host",
        dbHost,
        "--port",
        String(dbPort),
        "--username",
        dbUser,
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file",
        dumpFile,
        SOURCE_DB,
      ]);

      if (dump.status !== 0 || !fs.existsSync(dumpFile)) {
        throw new Error(
          `pg_dump завершился с кодом ${dump.status}; stderr не печатается (может содержать данные)`,
        );
      }

      await withAdmin(async (client) => {
        assertTestDatabase(COPY_DB);
        await client.query(`CREATE DATABASE "${COPY_DB}"`);
      });

      const restore = runPgTool("pg_restore", [
        "--host",
        dbHost,
        "--port",
        String(dbPort),
        "--username",
        dbUser,
        "--dbname",
        COPY_DB,
        "--no-owner",
        "--no-privileges",
        "--exit-on-error",
        dumpFile,
      ]);

      result.restoreExitCode = restore.status;
      result.createdFromDump = restore.status === 0;
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
      result.dumpRemoved = !fs.existsSync(workDir);
    }
  }

  result.counts = await counts();

  fs.mkdirSync(path.dirname(RESULT_JSON), { recursive: true });
  fs.writeFileSync(RESULT_JSON, JSON.stringify(result, null, 2), "utf8");

  console.log(`база ${COPY_DB}: ${result.existedBefore ? "уже существует" : "создана из дампа"}`);
  if (!result.existedBefore) {
    console.log(`pg_restore: код ${result.restoreExitCode}, дамп удалён: ${result.dumpRemoved ? "да" : "НЕТ"}`);
  }
  console.log(`users: ${result.counts.users}, cryptoinfavorites: ${result.counts.favorites}`);
  console.log(`артефакт: ${path.relative(ROOT, RESULT_JSON)}`);
}

await main();
