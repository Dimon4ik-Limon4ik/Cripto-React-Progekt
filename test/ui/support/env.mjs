// Окружение UI-тестов (этап 4).
// Порты 3000 и 5173 обычно заняты dev-серверами разработчика, поэтому
// тесты поднимают СВОИ экземпляры на отдельных портах.
// Запросы браузера к http://localhost:3000/* (жёстко зашиты в src/Services)
// перехватываются Playwright и уходят на same-origin прокси Vite:
//   http://localhost:3000/crypto/markets -> /__e2e-api/crypto/markets
//   Vite проксирует /__e2e-api/* -> http://127.0.0.1:3104/*
// Так браузер не делает CORS-preflight и не обращается к чужому серверу.
import path from "node:path";
import { BACKEND_DIR, ROOT, TMP_DIR, databaseUrl } from "../../api/support/env.mjs";

export { BACKEND_DIR, ROOT, TMP_DIR, databaseUrl };

export const BACKEND_PORT = 3104;
export const FRONTEND_PORT = 5174;
export const PROXY_PREFIX = "/__e2e-api";

export const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
export const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`;
export const PROXY_BASE = `${FRONTEND_URL}${PROXY_PREFIX}`;

export const FETCH_STUB = path.join(ROOT, "test", "api", "support", "fetch-stub.mjs");
export const VITE_BIN = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
export const VITE_CONFIG = path.join(ROOT, "test", "ui", "vite.e2e.config.mjs");

export const ARTIFACTS_DIR = path.join(TMP_DIR, "04-ui-artifacts");
export const SUMMARY_JSON = path.join(TMP_DIR, "04-ui-summary.json");
export const RESULTS_JSON = path.join(TMP_DIR, "04-ui-results.json");
export const BACKEND_LOG = path.join(TMP_DIR, "04-backend.log");
export const VITE_LOG = path.join(TMP_DIR, "04-vite.log");

// Тестовые аккаунты: по этому домену teardown удаляет ТОЛЬКО свои записи.
export const TEST_EMAIL_DOMAIN = "@vitest.local";

// Защита от случайного запуска против dev-серверов разработчика.
export function assertSafePorts() {
  const forbidden = [3000, 5173, 5432];
  const used = [BACKEND_PORT, FRONTEND_PORT];

  for (const port of used) {
    if (forbidden.includes(port)) {
      throw new Error(`Отказ: порт ${port} зарезервирован под dev-серверы`);
    }
  }

  if (BACKEND_PORT === FRONTEND_PORT) {
    throw new Error("Отказ: порты бэкенда и фронтенда совпадают");
  }

  if (!databaseUrl.includes("test")) {
    throw new Error("Отказ: UI-тесты запускаются только против базы с test в имени");
  }
}
