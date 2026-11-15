export default function validateDeleteAccount(req, res, next) {
  const { password } = req.body ?? {};

  if (typeof password !== "string" || !password) {
    return res.status(400).json({ error: "Введите текущий пароль" });
  }

  next();
}
