import dotenv from "dotenv";
import process from "node:process";
import { fileURLToPath } from "node:url";
import pg from "pg";

dotenv.config({ path: fileURLToPath(new URL("../secret.env", import.meta.url)) });

// Поддерживаем существующий secret.env с точкой с запятой после значений.
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
