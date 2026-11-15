// setupFiles: выполняется в каждом тестовом файле.
// После каждого теста удаляем созданные им записи, после файла — пул БД.
import { afterAll, afterEach } from "vitest";
import { cleanupTrackedUsers } from "./helpers.mjs";
import { closePool } from "./db.mjs";

afterEach(async () => {
  await cleanupTrackedUsers();
});

afterAll(async () => {
  await cleanupTrackedUsers();
  await closePool();
});
