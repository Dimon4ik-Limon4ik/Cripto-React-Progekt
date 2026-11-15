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

  next();
}