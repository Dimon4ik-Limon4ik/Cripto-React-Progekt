// добовляем в бд и создаём jwt token
import addUsersToBD from "./../services/addUsersToBD.js";
import CreateJWTtoken from "./../services/CreateJWTtoken.js";
import { pool } from "../services/poolBD.js";

export default async function registerUser(req, res) {
  try {
    // UNIQUE в users сравнивает email с учётом регистра, поэтому дубликат
    // «User@…» vs «user@…» проверяем отдельно и до хеширования пароля.
    const existing = await pool.query(
      "SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [req.body.email],
    );

    if (existing.rows[0]) {
      return res
        .status(409)
        .json({ error: "Пользователь с таким логином или email уже существует" });
    }

    const result = await addUsersToBD(req.body);
    const user = result.rows[0];
    const token = CreateJWTtoken(user.idusers);

    return res.status(201).json({
      message: "Учётная запись создана",
      userId: user.idusers,
      token: token,
    });
  } catch (err) {
    // 23505 — нарушение UNIQUE в PostgreSQL (логин или email уже заняты).
    if (err?.code === "23505") {
      return res
        .status(409)
        .json({ error: "Пользователь с таким логином или email уже существует" });
    }

    // Только код/сообщение: объект ошибки содержит email и текст SQL.
    console.error("Ошибка регистрации:", err.code ?? err.message);
    return res.status(500).json({ error: "Не удалось создать аккаунт" });
  }
}
