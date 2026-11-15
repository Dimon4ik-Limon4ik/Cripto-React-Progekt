// Доступ к копии БД из тестов (только чтение для проверок + удаление
// собственных тестовых записей). Пул закрывается в setup.mjs.
import pg from "../../../backend/node_modules/pg/lib/index.js";
import { databaseUrl } from "./env.mjs";

let pool = null;

export function getPool() {
  if (!pool) {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 4 });
  }
  return pool;
}

export async function query(sql, params) {
  return getPool().query(sql, params);
}

export async function scalar(sql, params) {
  const result = await getPool().query(sql, params);
  return Number(result.rows[0]?.count ?? 0);
}

export async function closePool() {
  if (pool) {
    const current = pool;
    pool = null;
    await current.end();
  }
}
