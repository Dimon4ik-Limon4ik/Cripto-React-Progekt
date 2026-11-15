import jwt from "jsonwebtoken";
export default function CreateJWTtoken(id) {
  // Токен действует 1 месяц — пользователю не придётся перелогиниваться
  // Алгоритм фиксируем явно: проверка токена принимает только HS256.
  return jwt.sign({ userId: id }, process.env.SECRET_KEY, {
    expiresIn: "30d",
    algorithm: "HS256",
  });
}
