// Верхние границы ввода: без них длинные строки зря нагружают БД и bcrypt.
// Логин ограничен 100 (а не 15, как в схеме): более длинный логин всё равно
// не найдётся, поэтому честнее ответить 401, но ввод должен быть ограничен.
const LOGIN_MAX_LENGTH = 100;
// 72 байта — предел bcrypt; более длинный пароль не даст доступа в любом случае.
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