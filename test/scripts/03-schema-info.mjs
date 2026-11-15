// Этап 3: схема копии БД (только чтение, без персональных данных).
// Печатает типы колонок и ограничения — нужны для отчёта о длинах полей.
// Запуск из корня проекта: node test/scripts/03-schema-info.mjs
import fs from "node:fs";
import path from "node:path";
import { COPY_DB, ROOT } from "../api/support/env.mjs";
import { closePool, query } from "../api/support/db.mjs";

const RESULT_JSON = path.join(ROOT, "test", "tmp", "03-schema.json");

const columns = await query(
  `SELECT table_name, column_name, data_type, character_maximum_length, is_nullable
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('users', 'cryptoinfavorites')
    ORDER BY table_name, ordinal_position`,
);

const constraints = await query(
  `SELECT c.conname AS name,
          c.contype AS type,
          t.relname AS table_name,
          pg_get_constraintdef(c.oid) AS definition
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname IN ('users', 'cryptoinfavorites')
    ORDER BY t.relname, c.conname`,
);

const payload = {
  createdAt: new Date().toISOString(),
  database: COPY_DB,
  columns: columns.rows,
  constraints: constraints.rows,
};

fs.mkdirSync(path.dirname(RESULT_JSON), { recursive: true });
fs.writeFileSync(RESULT_JSON, JSON.stringify(payload, null, 2), "utf8");

for (const row of columns.rows) {
  console.log(
    `${row.table_name}.${row.column_name}: ${row.data_type}` +
      `${row.character_maximum_length ? `(${row.character_maximum_length})` : ""} ` +
      `${row.is_nullable === "YES" ? "NULL" : "NOT NULL"}`,
  );
}

for (const row of constraints.rows) {
  console.log(`${row.table_name}: ${row.name} — ${row.definition}`);
}

console.log(`артефакт: ${path.relative(ROOT, RESULT_JSON)}`);

await closePool();
