import { pool } from "../services/poolBD.js";

export default async function clearFavorites(req, res) {
  try {
    await pool.query("DELETE FROM cryptoinfavorites WHERE idusers = $1", [
      req.user.userId,
    ]);

    return res.status(200).json({ favorites: [] });
  } catch (error) {
    console.error("Ошибка очистки избранного:", error);
    return res.status(500).json({ error: "Не удалось очистить избранное" });
  }
}