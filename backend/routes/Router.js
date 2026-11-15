import express from "express";
import registerUser from "../controllers/addUsers.js";
import loginUser from "../controllers/login.js";
import getProfile from "../controllers/getProfile.js";
import changePassword from "../controllers/changePassword.js";
import deleteAccount from "../controllers/deleteAccount.js";
import validateRegister from "../middleware/validateRegister.js";
import validateLogin from "../middleware/validateLogin.js";
import validateChangePassword from "../middleware/validateChangePassword.js";
import validateDeleteAccount from "../middleware/validateDeleteAccount.js";
import TokenCheck from "./../middleware/TokenCheck.js"
import rateLimit from "../middleware/rateLimit.js";

const router = express.Router();

// Ключ обязательно включает логин/email: иначе пользователи (и тесты)
// с разными логинами мешали бы друг другу при общем IP.
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyOf: (req) =>
    `login:${req.ip}:${String(req.body?.login ?? "").slice(0, 50).toLowerCase()}`,
  message: "Слишком много попыток входа. Попробуйте позже",
});

const registerRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyOf: (req) =>
    `reg:${req.ip}:${String(req.body?.email ?? "").slice(0, 100).toLowerCase()}`,
  message: "Слишком много попыток регистрации. Попробуйте позже",
});

router.post("/addUsers", registerRateLimit, validateRegister, registerUser);
router.post("/login", loginRateLimit, validateLogin, loginUser);

// Защищённые JWT-маршруты профиля.
router.get("/profile", TokenCheck, getProfile);
router.patch(
  "/changePassword",
  TokenCheck,
  validateChangePassword,
  changePassword,
);
router.delete(
  "/deleteAccount",
  TokenCheck,
  validateDeleteAccount,
  deleteAccount,
);

router.get("/tokenCheck", TokenCheck, (req, res) => {
  // Токен валиден — подтверждаем автовход
  res.status(200).json({ valid: true, userId: req.user.userId });
});
export default router;
