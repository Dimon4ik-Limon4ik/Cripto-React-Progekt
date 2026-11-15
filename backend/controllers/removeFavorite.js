import { pool } from "../services/poolBD.js";
import getUserFavorites from "../services/getUserFavorites.js";

export default async function removeFavorite(req, res) {
  try {
    await pool.query(
      "DELETE FROM cryptoinfavorites WHERE idusers = $1 AND idcrypto = $2",
      [req.user.userId, req.favoriteCoinId],
    );

    const favorites = await getUserFavorites(req.user.userId);
    return res.status(200).json({ favorites });
  } catch (error) {
    console.error("Ошибка удаления из избранного:", error);
    return res
      .status(500)
      .json({ error: "Не удалось удалить монету из избранного" });
  }
}