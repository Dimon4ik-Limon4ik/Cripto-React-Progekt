// добовляем в бд и создаём jwt token
import addUsersToBD from "./../services/addUsersToBD.js";
import CreateJWTtoken from "./../services/CreateJWTtoken.js";
export default async function registerUser(req, res) {
  try {
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

    console.error("Ошибка регистрации:", err);
    return res.status(500).json({ error: "Не удалось создать аккаунт" });
  }
}
