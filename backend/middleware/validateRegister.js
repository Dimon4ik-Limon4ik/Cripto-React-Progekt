const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// проверка данных при регистрации на валидность
export default function validateRegister(req, res, next) {
  const data = req.body ?? {};
  const requiredFields = ["name", "login", "password", "email"];

  if (requiredFields.some((field) => typeof data[field] !== "string" || !data[field].trim())) {
    return res.status(400).json({ error: "Заполните все поля регистрации" });
  }

  const name = data.name.trim();
  const login = data.login.trim();
  const email = data.email.trim();

  if (name.length < 2 || name.length > 50) {
    return res
      .status(400)
      .json({ error: "Имя должно содержать от 2 до 50 символов" });
  }

  if (login.length < 6 || login.length > 15) {
    return res
      .status(400)
      .json({ error: "Логин должен содержать от 6 до 15 символов" });
  }

  if (/\s/.test(login)) {
    return res.status(400).json({ error: "Логин не должен содержать пробелы" });
  }

  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: "Введите корректный email" });
  }

  if (data.password.length < 6 || data.password.length > 15) {
    return res
      .status(400)
      .json({ error: "Пароль должен содержать от 6 до 15 символов" });
  }

  // Сохраняем уже нормализованные значения, чтобы в БД не попадали лишние пробелы.
  req.body = { ...data, name, login, email };

  next();
}