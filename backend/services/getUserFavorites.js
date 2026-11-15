import { pool } from "./poolBD.js";

// Избранные монеты конкретного пользователя: общий список исключён.
export default async function getUserFavorites(userId) {
  const result = await pool.query(
    `SELECT idcrypto
     FROM cryptoinfavorites
     WHERE idusers = $1
     ORDER BY created_at ASC, idcrypto ASC`,
    [userId],
  );

  return result.rows.map((row) => row.idcrypto);
}