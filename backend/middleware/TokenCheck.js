//проверяем токен на валиднось и пустоту
import jwt from "jsonwebtoken";
import { pool } from "../services/poolBD.js";

export default async function TokenCheck(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Токен отсутствует" });
  }

  let decoded;

  try {
    decoded = jwt.verify(authHeader.split(" ")[1], process.env.SECRET_KEY);
  } catch (err) {
    console.error("Ошибка проверки токена:", err.message);
    return res.status(401).json({ error: "Токен недействителен" });
  }

  // Старые токены могли быть выпущены без userId — для профиля они бесполезны.
  if (!decoded || typeof decoded !== "object" || !decoded.userId) {
    return res.status(401).json({ error: "Сессия устарела. Войдите снова" });
  }

  try {
    // После удаления аккаунта его JWT больше не должен давать доступ.
    const result = await pool.query(
      "SELECT 1 FROM users WHERE idusers = $1 LIMIT 1",
      [decoded.userId],
    );

    if (!result.rows[0]) {
      return res.status(401).json({ error: "Пользователь не найден" });
    }
  } catch (err) {
    // Недоступная БД — это не повод разлогинивать пользователя.
    console.error("Ошибка проверки пользователя:", err.message);
    return res.status(503).json({ error: "Сервис временно недоступен" });
  }

  req.user = decoded;
  next();
}

