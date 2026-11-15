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
const router = express.Router();
router.post("/addUsers", validateRegister, registerUser);
router.post("/login", validateLogin, loginUser);

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
