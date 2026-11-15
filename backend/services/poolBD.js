import dotenv from "dotenv";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

// Секреты лежат в secrets/.env в корне проекта и не коммитятся в Git.
dotenv.config({ path: fileURLToPath(new URL("../../secrets/.env", import.meta.url)) });

// Поддерживаем значения с точкой с запятой после них.
for (const key of ["SECRET_KEY", "UserBD", "passwordBD"]) {
  const value = process.env[key]?.trim();
  if (value) {
    process.env[key] = value.replace(/^(["'])(.*)\1;?$/, "$2").replace(/;$/, "");
  }
}

const { Pool } = pg;
export const pool = new Pool({
  user: process.env.UserBD,
  password: process.env.passwordBD,
  host: "localhost",
  port: 5432,
  database: "my_crypto",
});
