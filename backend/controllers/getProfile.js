import { pool } from "../services/poolBD.js";

export default async function getProfile(req, res) {
  try {
    const result = await pool.query(
      "SELECT idusers, name, login, email, created_at FROM users WHERE idusers = $1 LIMIT 1",
      [req.user.userId],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    return res.status(200).json({
      user: {
        id: user.idusers,
        name: user.name,
        login: user.login,
        email: user.email,
        registeredAt: user.created_at,
      },
    });
  } catch (error) {
    console.error("Ошибка загрузки профиля:", error);
    return res
      .status(500)
      .json({ error: "Не удалось загрузить данные профиля" });
  }
}
