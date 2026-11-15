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
    decoded = jwt.verify(authHeader.split(" ")[1], process.env.SECRET_KEY, {
      algorithms: ["HS256"],
    });
  } catch (err) {
    console.error("Ошибка проверки токена:", err.code ?? err.message);
    return res.status(401).json({ error: "Токен недействителен" });
  }

  // Старые токены могли быть выпущены без userId — для профиля они бесполезны.
  if (!decoded || typeof decoded !== "object" || !decoded.userId) {
    return res.status(401).json({ error: "Сессия устарела. Войдите снова" });
  }

  try {
    // После удаления аккаунта его JWT больше не должен давать доступ.
    const result = await pool.query(
      "SELECT password_changed_at FROM users WHERE idusers = $1 LIMIT 1",
      [decoded.userId],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: "Пользователь не найден" });
    }

    const changedAt = user.password_changed_at
      ? new Date(user.password_changed_at).getTime()
      : 0;

    // iat — в секундах; токен, выпущенный до смены пароля, больше не действует.
    if (changedAt > 0 && typeof decoded.iat === "number" && decoded.iat * 1000 < changedAt) {
      return res.status(401).json({ error: "Сессия устарела. Войдите снова" });
    }
  } catch (err) {
    // Недоступная БД — это не повод разлогинивать пользователя.
    console.error("Ошибка проверки пользователя:", err.code ?? err.message);
    return res.status(503).json({ error: "Сервис временно недоступен" });
  }

  req.user = decoded;
  next();
}

