import { pool } from "./poolBD.js";

// Таблицу users раньше приходилось создавать вручную: на чистой базе ALTER
// падал. Теперь схема поднимается сама, но существующую таблицу и её данные
// команды не меняют — CREATE IF NOT EXISTS просто ничего не делает.
export default async function ensureUsersSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      idusers SERIAL PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      login VARCHAR(15) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Дата регистрации нужна странице профиля: в старых базах колонки не было.
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
}
