import { pool } from "./poolBD.js";

// Таблица уже могла существовать без связей с пользователем — приводим её
// к персональному виду: пара (пользователь, монета) уникальна, а при
// удалении аккаунта избранное удаляется каскадно.
export default async function ensureFavoritesSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cryptoinfavorites (
      idusers INTEGER NOT NULL,
      idcrypto VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE cryptoinfavorites
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  `);

  // Старые строки без владельца или монеты не имеют смысла.
  await pool.query(`
    DELETE FROM cryptoinfavorites
    WHERE idusers IS NULL OR idcrypto IS NULL
  `);

  // Без первичного ключа могли накопиться одинаковые пары.
  await pool.query(`
    DELETE FROM cryptoinfavorites a
    USING cryptoinfavorites b
    WHERE a.ctid < b.ctid
      AND a.idusers = b.idusers
      AND a.idcrypto = b.idcrypto
  `);

  await pool.query(`
    ALTER TABLE cryptoinfavorites
    ALTER COLUMN idusers SET NOT NULL
  `);

  await pool.query(`
    ALTER TABLE cryptoinfavorites
    ALTER COLUMN idcrypto SET NOT NULL
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'cryptoinfavorites'::regclass
          AND contype = 'p'
      ) THEN
        ALTER TABLE cryptoinfavorites
        ADD CONSTRAINT cryptoinfavorites_pkey PRIMARY KEY (idusers, idcrypto);
      END IF;
    END
    $$;
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'cryptoinfavorites'::regclass
          AND contype = 'f'
          AND confrelid = 'users'::regclass
      ) THEN
        ALTER TABLE cryptoinfavorites
        ADD CONSTRAINT cryptoinfavorites_idusers_fkey
        FOREIGN KEY (idusers) REFERENCES users(idusers) ON DELETE CASCADE;
      END IF;
    END
    $$;
  `);
}