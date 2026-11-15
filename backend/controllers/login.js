import bcrypt from "bcrypt";
import CreateJWTtoken from "../services/CreateJWTtoken.js";
import { pool } from "../services/poolBD.js";

export default async function loginUser(req, res) {
  try {
    const { login, password } = req.body;
    const result = await pool.query(
      "SELECT * FROM users WHERE login = $1 LIMIT 1",
      [login.trim()],
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Неверный логин или пароль" });
    }

    const token = CreateJWTtoken(user.idusers);
    return res.status(200).json({
      message: "Вход выполнен",
      userId: user.idusers,
      token,
    });
  } catch (error) {
    console.error("Ошибка входа:", error.code ?? error.message);
    return res.status(500).json({ error: "Не удалось выполнить вход" });
  }
}