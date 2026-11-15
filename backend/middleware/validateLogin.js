// Те же границы, что при регистрации, плюс предел bcrypt в байтах.
const LOGIN_MAX_LENGTH = 15;
const PASSWORD_MAX_LENGTH = 72;

export default function validateLogin(req, res, next) {
  const { login, password } = req.body ?? {};

  if (
    typeof login !== "string" ||
    !login.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({ error: "Введите логин и пароль" });
  }

  // Без верхней границы длинные строки зря нагружают БД и bcrypt.
  if (login.trim().length > LOGIN_MAX_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return res.status(400).json({ error: "Слишком длинный логин или пароль" });
  }

  next();
}