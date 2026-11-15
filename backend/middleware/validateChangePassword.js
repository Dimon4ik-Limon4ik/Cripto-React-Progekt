export default function validateChangePassword(req, res, next) {
  const { currentPassword, newPassword, confirmPassword } = req.body ?? {};

  if (
    typeof currentPassword !== "string" ||
    !currentPassword ||
    typeof newPassword !== "string" ||
    !newPassword ||
    typeof confirmPassword !== "string" ||
    !confirmPassword
  ) {
    return res.status(400).json({ error: "Заполните все поля" });
  }

  if (newPassword.length < 6 || newPassword.length > 15) {
    return res
      .status(400)
      .json({ error: "Новый пароль должен содержать от 6 до 15 символов" });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: "Новые пароли не совпадают" });
  }

  next();
}
