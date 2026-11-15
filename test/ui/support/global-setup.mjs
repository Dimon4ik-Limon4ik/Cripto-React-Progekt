// Global setup для UI-тестов: поднимает тестовый бэкенд (NODE_ENV=test,
// копия БД) и Vite на свободных портах, затем всё останавливает и чистит
// только свои тестовые аккаунты.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ARTIFACTS_DIR,
  BACKEND_DIR,
  BACKEND_LOG,
  BACKEND_PORT,
  BACKEND_URL,
  FETCH_STUB,
  FRONTEND_PORT,
  FRONTEND_URL,
  ROOT,
  SUMMARY_JSON,
  TEST_EMAIL_DOMAIN,
  VITE_BIN,
  VITE_CONFIG,
  VITE_LOG,
  assertSafePorts,
  databaseUrl,
} from "./env.mjs";
import { closePool, query, scalar } from "../../api/support/db.mjs";

function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: "127.0.0.1", port });

    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      reject(
        new Error(
          `Порт ${port} уже занят. Освободите его или измените порт в test/ui/support/env.mjs`,
        ),
      );
    });
    socket.once("timeout", () => {
      socket.destroy();
      resolve();
    });
    socket.once("error", () => {
      socket.destroy();
      resolve();
    });
  });
}

async function waitForHttp(url, timeoutMs = 60_000) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.status < 500) {
        return true;
      }
    } catch {
      // сервер ещё стартует
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return false;
}

function spawnNode(args, options) {
  return spawn(process.execPath, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;

  child.kill();

  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
  ]);

  if (!exited) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  }
}

function ensureCopyDatabase() {
  const result = spawnSync(process.execPath, [path.join(ROOT, "test", "scripts", "03-ensure-copy.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error("Не удалось подготовить копию БД (см. test/tmp/03-ensure-copy.json)");
  }
}

// В логах сервера не должно быть персональных данных, поэтому пишем только
// строки старта и [schema], а для ошибок — лишь их количество.
function createLogCollector(file) {
  const keep = [];
  let errorLines = 0;

  const onData = (chunk) => {
    for (const line of String(chunk).split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.includes("[schema]") || trimmed.includes("Сервер запущен")) {
        keep.push(trimmed);
      } else if (/ошибк|error/i.test(trimmed)) {
        errorLines += 1;
      }
    }
  };

  const flush = () => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      `${keep.join("\n")}\n[строк с ошибками (текст не сохраняется): ${errorLines}]\n`,
      "utf8",
    );
    return errorLines;
  };

  return { onData, flush };
}

export default async function setup() {
  assertSafePorts();
  await assertPortFree(BACKEND_PORT);
  await assertPortFree(FRONTEND_PORT);

  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  ensureCopyDatabase();

  const backendLog = createLogCollector(BACKEND_LOG);
  const viteLog = createLogCollector(VITE_LOG);

  const backend = spawnNode(
    ["--import", pathToFileURL(FETCH_STUB).href, "server.js"],
    {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL_TEST: databaseUrl,
        PORT: String(BACKEND_PORT),
        CLIENT_ORIGINS: `http://127.0.0.1:${FRONTEND_PORT},http://localhost:${FRONTEND_PORT}`,
      },
    },
  );

  const vite = spawnNode([VITE_BIN, "--config", VITE_CONFIG], {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: "development" },
  });

  backend.stdout.on("data", backendLog.onData);
  backend.stderr.on("data", backendLog.onData);
  vite.stdout.on("data", viteLog.onData);
  vite.stderr.on("data", viteLog.onData);

  const children = [backend, vite];

  try {
    const [backendReady, frontendReady] = await Promise.all([
      waitForHttp(`${BACKEND_URL}/`),
      waitForHttp(FRONTEND_URL),
    ]);

    if (!backendReady || !frontendReady) {
      throw new Error(
        `Не поднялись сервисы: backend=${backendReady}, frontend=${frontendReady} ` +
          "(детали в test/tmp/04-backend.log и 04-vite.log)",
      );
    }

    // Остатки прерванных прогонов (@vitest.local) удаляем ДО снятия baseline,
    // иначе preserved=false покажет влияние прошлого сбоя, а не текущего прогона.
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

    return async () => {
      for (const child of children) {
        await stopChild(child);
      }

      const backendErrorLines = backendLog.flush();
      viteLog.flush();

      // Удаляем только тестовые аккаунты (@vitest.local); их избранное
      // уходит каскадом. Существующие данные копии не трогаем.
      const leftover = await query("SELECT idusers FROM users WHERE email LIKE $1", [
        `%${TEST_EMAIL_DOMAIN}`,
      ]);
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
            backend: BACKEND_URL,
            frontend: FRONTEND_URL,
            database: "my_crypto_copy_test",
            baseline,
            final,
            preserved:
              baseline.users === final.users && baseline.favorites === final.favorites,
            leftoverBeforeCleaned: staleIds.length,
            leftoverRemoved: leftoverIds.length,
            backendErrorLines,
          },
          null,
          2,
        ),
        "utf8",
      );

      if (baseline.users !== final.users || baseline.favorites !== final.favorites) {
        throw new Error(
          "UI-тесты изменили существующие данные копии: " +
            `users ${baseline.users} -> ${final.users}, ` +
            `cryptoinfavorites ${baseline.favorites} -> ${final.favorites}`,
        );
      }
    };
  } catch (error) {
    for (const child of children) {
      await stopChild(child);
    }
    await closePool();
    throw error;
  }
}

