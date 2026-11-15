import { pool } from "./poolBD.js";

// Дата регистрации нужна странице профиля. Колонки может не быть в старых
// базах, поэтому добавляем её идемпотентно при старте сервера.
export default async function ensureUsersSchema() {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);
}
