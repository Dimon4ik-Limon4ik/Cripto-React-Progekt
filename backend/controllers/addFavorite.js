import { pool } from "../services/poolBD.js";
import getUserFavorites from "../services/getUserFavorites.js";

export default async function addFavorite(req, res) {
  try {
    // Повторное добавление той же монеты не создаёт дубликат.
    // Вместо ON CONFLICT — INSERT ... SELECT: работает и без уникального индекса.
    await pool.query(
      `INSERT INTO cryptoinfavorites (idusers, idcrypto)
       SELECT $1::int, $2::text
       WHERE NOT EXISTS (
         SELECT 1 FROM cryptoinfavorites WHERE idusers = $1 AND idcrypto = $2
       )`,
      [req.user.userId, req.favoriteCoinId],
    );

    const favorites = await getUserFavorites(req.user.userId);
    return res.status(200).json({ favorites });
  } catch (error) {
    console.error("Ошибка добавления в избранное:", error.code ?? error.message);
    return res
      .status(500)
      .json({ error: "Не удалось добавить монету в избранное" });
  }
}