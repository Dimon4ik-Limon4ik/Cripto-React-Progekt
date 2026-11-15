// Общее окружение API-тестов: пути, секреты (только в рантайме), URL копии БД.
// Значения секретов никогда не печатаются и не попадают в артефакты.
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// test/api/support -> корень проекта
export const ROOT = path.resolve(HERE, "..", "..", "..");
export const BACKEND_DIR = path.join(ROOT, "backend");
export const ENV_PATH = path.join(ROOT, "secrets", ".env");
export const TMP_DIR = path.join(ROOT, "test", "tmp");

// Тестовая база — только копия: имя содержит "test".
export const COPY_DB = "my_crypto_copy_test";
export const API_PORT = Number(process.env.API_TEST_PORT || 3111);
export const BASE_URL = `http://127.0.0.1:${API_PORT}`;

export async function loadBackendModule(relativePath) {
  const module = await import(pathToFileURL(path.join(BACKEND_DIR, relativePath)).href);
  return module.default ?? module;
}

const dotenv = await loadBackendModule("node_modules/dotenv/lib/main.js");
dotenv.config({ path: ENV_PATH, quiet: true });

// Значения в secrets/.env могут быть в кавычках и с точкой с запятой.
export function cleanEnvValue(value) {
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

export const dbUser = cleanEnvValue(process.env.UserBD);
export const dbPassword = cleanEnvValue(process.env.passwordBD);
export const jwtSecret = cleanEnvValue(process.env.SECRET_KEY);
export const coinGeckoKey = cleanEnvValue(process.env.COINGECKO_API_KEY);

export const dbHost = "localhost";
export const dbPort = 5432;

export function buildDatabaseUrl(database) {
  const credentials = `${encodeURIComponent(dbUser)}:${encodeURIComponent(dbPassword)}`;
  return `postgres://${credentials}@${dbHost}:${dbPort}/${database}`;
}

if (!dbUser || !dbPassword) {
  throw new Error("В secrets/.env не найдены UserBD/passwordBD");
}

export const databaseUrl =
  cleanEnvValue(process.env.DATABASE_URL_TEST) || buildDatabaseUrl(COPY_DB);
