import bcrypt from "bcrypt";
import { pool } from "../services/poolBD.js";

export default async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await pool.query(
      "SELECT password FROM users WHERE idusers = $1 LIMIT 1",
      [req.user.userId],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ error: "Пользователь не найден" });
    }

    // Текущий пароль обязательно сверяем с bcrypt-хешем в базе.
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Неверный текущий пароль" });
    }

    // Смена «на тот же пароль» ничего не меняет, но разлогинила бы сессии.
    if (await bcrypt.compare(newPassword, user.password)) {
      return res.status(400).json({ error: "Новый пароль совпадает с текущим" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Дата смены нужна, чтобы старые токены перестали действовать.
    await pool.query(
      "UPDATE users SET password = $1, password_changed_at = NOW() WHERE idusers = $2",
      [passwordHash, req.user.userId],
    );

    return res.status(200).json({ message: "Пароль изменён" });
  } catch (error) {
    console.error("Ошибка смены пароля:", error.code ?? error.message);
    return res.status(500).json({ error: "Не удалось изменить пароль" });
  }
}
