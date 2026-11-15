import dotenv from "dotenv";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Секреты лежат в secrets/.env в корне проекта и не коммитятся в Git.
dotenv.config({ path: fileURLToPath(new URL("../../secrets/.env", import.meta.url)) });

// Поддерживаем значения с точкой с запятой после них. Строка подключения
// к тестовой БД может прийти из CI и тоже нуждается в такой же чистке.
for (const key of ["SECRET_KEY", "UserBD", "passwordBD", "DATABASE_URL_TEST"]) {
  const value = process.env[key]?.trim();
  if (value) {
    process.env[key] = value.replace(/^(["'])(.*)\1;?$/, "$2").replace(/;$/, "");
  }
}

const { Pool } = pg;

// Имя базы достаём из строки подключения, чтобы в тестах случайно не
// подключиться к рабочей базе. Сам URL и пароль нигде не выводятся.
function getDatabaseName(connectionString) {
  try {
    return decodeURIComponent(new URL(connectionString).pathname.slice(1));
  } catch {
    return "";
  }
}

const isTestEnv = process.env.NODE_ENV === "test";
const testDatabaseUrl = process.env.DATABASE_URL_TEST?.trim();

if (isTestEnv) {
  // В тестах допускаем только явно заданную отдельную базу.
  if (!testDatabaseUrl) {
    throw new Error(
      "NODE_ENV=test, но переменная окружения DATABASE_URL_TEST не задана: подключение к тестовой БД невозможно.",
    );
  }

  const testDatabaseName = getDatabaseName(testDatabaseUrl);

  if (!testDatabaseName) {
    throw new Error(
      "NODE_ENV=test: не удалось определить имя базы в DATABASE_URL_TEST — подключение отменено.",
    );
  }

  if (!testDatabaseName.toLowerCase().includes("test")) {
    throw new Error(
      "NODE_ENV=test: имя базы в DATABASE_URL_TEST не содержит «test» — подключение к потенциально рабочей БД отменено.",
    );
  }
}

export const pool = isTestEnv
  ? new Pool({ connectionString: testDatabaseUrl })
  : new Pool({
      user: process.env.UserBD,
      password: process.env.passwordBD,
      host: "localhost",
      port: 5432,
      database: "my_crypto",
    });
