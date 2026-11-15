import bcrypt from "bcrypt";
import { pool } from "../services/poolBD.js";

export default async function deleteAccount(req, res) {
  try {
    const { password } = req.body;
    const result = await pool.query(
      "SELECT password FROM users WHERE idusers = $1 LIMIT 1",
      [req.user.userId],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    // Перед удалением подтверждаем личность текущим паролем через bcrypt.
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Неверный текущий пароль" });
    }

    await pool.query("DELETE FROM users WHERE idusers = $1", [
      req.user.userId,
    ]);

    return res.status(200).json({ message: "Аккаунт удалён" });
  } catch (error) {
    console.error("Ошибка удаления аккаунта:", error.code ?? error.message);
    return res.status(500).json({ error: "Не удалось удалить аккаунт" });
  }
}
