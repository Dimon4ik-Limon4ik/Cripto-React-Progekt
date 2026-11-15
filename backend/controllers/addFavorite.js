import { pool } from "../services/poolBD.js";
import getUserFavorites from "../services/getUserFavorites.js";

export default async function addFavorite(req, res) {
  try {
    // Повторное добавление той же монеты не создаёт дубликат.
    await pool.query(
      `INSERT INTO cryptoinfavorites (idusers, idcrypto)
       VALUES ($1, $2)
       ON CONFLICT (idusers, idcrypto) DO NOTHING`,
      [req.user.userId, req.favoriteCoinId],
    );

    const favorites = await getUserFavorites(req.user.userId);
    return res.status(200).json({ favorites });
  } catch (error) {
    console.error("Ошибка добавления в избранное:", error);
    return res
      .status(500)
      .json({ error: "Не удалось добавить монету в избранное" });
  }
}