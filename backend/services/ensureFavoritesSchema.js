import { pool } from "./poolBD.js";

const TABLE = "cryptoinfavorites";
const USERS_TABLE = "users";

// Порядок колонок в pg_constraint не важен — сравниваем наборы.
function sameColumns(actual, expected) {
  if (!Array.isArray(actual)) {
    return false;
  }

  const left = [...actual].sort();
  const right = [...expected].sort();

  return (
    left.length === right.length &&
    left.every((column, index) => column === right[index])
  );
}

// regclass::text возвращает "users" или "public.users".
function unqualifiedName(name) {
  return String(name ?? "").split(".").pop();
}

async function countRows(client, sql) {
  const result = await client.query(sql);
  return Number(result.rows[0]?.count ?? 0);
}

async function getPrimaryKeys(client) {
  const result = await client.query(
    `SELECT c.conname,
            array_agg(a.attname::text ORDER BY a.attname::text) AS columns
     FROM pg_constraint c
     JOIN pg_attribute a
       ON a.attrelid = c.conrelid
      AND a.attnum = ANY (c.conkey)
     WHERE c.conrelid = $1::regclass
       AND c.contype = 'p'
     GROUP BY c.conname`,
    [TABLE],
  );

  return result.rows;
}

async function getForeignKeys(client) {
  const result = await client.query(
    `SELECT c.conname,
            c.confrelid::regclass::text AS ref_table,
            c.confdeltype AS delete_action,
            (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
               FROM pg_attribute a
              WHERE a.attrelid = c.conrelid
                AND a.attnum = ANY (c.conkey)) AS columns,
            (SELECT array_agg(a.attname::text ORDER BY a.attname::text)
               FROM pg_attribute a
              WHERE a.attrelid = c.confrelid
                AND a.attnum = ANY (c.confkey)) AS ref_columns
     FROM pg_constraint c
     WHERE c.conrelid = $1::regclass
       AND c.contype = 'f'`,
    [TABLE],
  );

  return result.rows;
}

async function isColumnNotNull(client, column) {
  const result = await client.query(
    `SELECT a.attnotnull AS not_null
     FROM pg_attribute a
     WHERE a.attrelid = $1::regclass
       AND a.attname = $2
       AND a.attnum > 0
       AND NOT a.attisdropped`,
    [TABLE, column],
  );

  return result.rows[0]?.not_null === true;
}

// Шаг под SAVEPOINT: неудача не рвёт транзакцию и не трогает данные,
// в лог попадает только причина без самих строк.
async function runStep(client, name, warnings, action) {
  await client.query(`SAVEPOINT ${name}`);

  try {
    await action();
    await client.query(`RELEASE SAVEPOINT ${name}`);
  } catch (error) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    warnings.push(`шаг ${name} пропущен: ${error.message}`);
  }
}

// Таблица уже могла существовать без связей с пользователем — приводим её
// к персональному виду. Данные не удаляются ни при каких условиях: если
// что-то мешает (NULL, дубликаты, сироты), шаг пропускается с предупреждением.
export default async function ensureFavoritesSchema() {
  const client = await pool.connect();
  const warnings = [];

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS cryptoinfavorites (
        idusers INTEGER NOT NULL,
        idcrypto VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE cryptoinfavorites
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    `);

    // Проблемные строки только считаем: DELETE в этом файле нет.
    const nullUsers = await countRows(
      client,
      "SELECT count(*) AS count FROM cryptoinfavorites WHERE idusers IS NULL",
    );
    const nullCryptos = await countRows(
      client,
      "SELECT count(*) AS count FROM cryptoinfavorites WHERE idcrypto IS NULL",
    );

    for (const [column, nullCount] of [
      ["idusers", nullUsers],
      ["idcrypto", nullCryptos],
    ]) {
      if (nullCount > 0) {
        warnings.push(
          `NOT NULL для ${column} не добавлен: строк с NULL — ${nullCount}`,
        );
        continue;
      }

      if (await isColumnNotNull(client, column)) {
        continue;
      }

      await runStep(client, `set_not_null_${column}`, warnings, async () => {
        await client.query(
          `ALTER TABLE cryptoinfavorites ALTER COLUMN ${column} SET NOT NULL`,
        );
      });
    }

    const primaryKeys = await getPrimaryKeys(client);
    const hasTargetPrimaryKey = primaryKeys.some((row) =>
      sameColumns(row.columns, ["idusers", "idcrypto"]),
    );

    if (!hasTargetPrimaryKey) {
      if (primaryKeys.length > 0) {
        warnings.push(
          `PRIMARY KEY (idusers, idcrypto) не добавлен: у таблицы уже есть другой первичный ключ (${primaryKeys
            .map((row) => row.conname)
            .join(", ")})`,
        );
      } else {
        const duplicates = await countRows(
          client,
          `SELECT COALESCE(sum(duplicated.count - 1), 0) AS count
           FROM (
             SELECT count(*) AS count
             FROM cryptoinfavorites
             WHERE idusers IS NOT NULL AND idcrypto IS NOT NULL
             GROUP BY idusers, idcrypto
             HAVING count(*) > 1
           ) duplicated`,
        );
        const blockers = [];

        if (nullUsers > 0) {
          blockers.push(`NULL idusers — ${nullUsers}`);
        }

        if (nullCryptos > 0) {
          blockers.push(`NULL idcrypto — ${nullCryptos}`);
        }

        if (duplicates > 0) {
          blockers.push(`дубликатов пар — ${duplicates}`);
        }

        if (blockers.length > 0) {
          warnings.push(
            `PRIMARY KEY (idusers, idcrypto) не добавлен: ${blockers.join(", ")}`,
          );
        } else {
          await runStep(client, "add_primary_key", warnings, async () => {
            await client.query(`
              ALTER TABLE cryptoinfavorites
              ADD CONSTRAINT cryptoinfavorites_pkey PRIMARY KEY (idusers, idcrypto)
            `);
          });
        }
      }
    }

    const usersTable = await client.query("SELECT to_regclass($1) AS name", [
      USERS_TABLE,
    ]);

    if (!usersTable.rows[0]?.name) {
      warnings.push("FOREIGN KEY не добавлен: таблица users отсутствует");
    } else {
      const foreignKeys = await getForeignKeys(client);
      const isUsersReference = (row) =>
        sameColumns(row.columns, ["idusers"]) &&
        unqualifiedName(row.ref_table) === USERS_TABLE &&
        sameColumns(row.ref_columns, ["idusers"]);
      const hasCascadeForeignKey = foreignKeys.some(
        (row) => isUsersReference(row) && row.delete_action === "c",
      );
      const foreignKeyWithoutCascade = foreignKeys.find(
        (row) => isUsersReference(row) && row.delete_action !== "c",
      );

      if (!hasCascadeForeignKey) {
        if (foreignKeyWithoutCascade) {
          warnings.push(
            `FOREIGN KEY не изменён: ${foreignKeyWithoutCascade.conname} ссылается на users(idusers) без ON DELETE CASCADE`,
          );
        } else {
          const orphans = await countRows(
            client,
            `SELECT count(*) AS count
             FROM cryptoinfavorites favorites
             WHERE favorites.idusers IS NOT NULL
               AND NOT EXISTS (
                 SELECT 1 FROM users WHERE users.idusers = favorites.idusers
               )`,
          );

          if (orphans > 0) {
            warnings.push(
              `FOREIGN KEY не добавлен: избранных с несуществующим пользователем — ${orphans}`,
            );
          } else {
            await runStep(client, "add_foreign_key", warnings, async () => {
              await client.query(`
                ALTER TABLE cryptoinfavorites
                ADD CONSTRAINT cryptoinfavorites_idusers_fkey
                FOREIGN KEY (idusers) REFERENCES users(idusers) ON DELETE CASCADE
              `);
            });
          }
        }
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Не удалось откатить транзакцию подготовки схемы избранного:",
        rollbackError.message,
      );
    }

    throw error;
  } finally {
    client.release();
  }

  for (const warning of warnings) {
    console.warn(`[schema] cryptoinfavorites: ${warning}`);
  }
}

