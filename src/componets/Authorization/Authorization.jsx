import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Authorization.css";
import { useAuth } from "../../Context/AuthContext.jsx";
import { NotificationsContext } from "../../Context/NotificationsContext.jsx";
import { addUserAndSaveToken } from "../../Services/addUserAndSaveToken.js";
import loginAndSaveToken from "../../Services/loginAndSaveToken.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getValidationError(values, isRegistration) {
  const name = values.name?.trim() ?? "";
  const login = values.login?.trim() ?? "";
  const email = values.email?.trim() ?? "";
  const password = values.password ?? "";

  if (!login || !password || (isRegistration && (!name || !email))) {
    return "Заполните все поля";
  }

  if (isRegistration) {
    if (name.length < 2 || name.length > 50) {
      return "Имя должно содержать от 2 до 50 символов";
    }
    if (login.length < 6 || login.length > 15) {
      return "Логин должен содержать от 6 до 15 символов";
    }
    if (/\s/.test(login)) {
      return "Логин не должен содержать пробелы";
    }
    if (!EMAIL_PATTERN.test(email)) {
      return "Введите корректный email";
    }
    if (password.length < 6 || password.length > 15) {
      return "Пароль должен содержать от 6 до 15 символов";
    }
  }

  return null;
}

export default function Authorization() {
  const [isRegistration, setIsRegistration] = useState(true);
  const [isPending, setIsPending] = useState(false);

  const { signIn } = useAuth();
  const { addNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isPending) return;

    const formData = Object.fromEntries(new FormData(event.currentTarget));
    const validationError = getValidationError(formData, isRegistration);

    if (validationError) {
      addNotification(validationError, "error");
      return;
    }

    setIsPending(true);

    try {
      const token = isRegistration
        ? await addUserAndSaveToken(formData)
        : await loginAndSaveToken(formData);

      signIn(token);
      addNotification(
        isRegistration ? "Аккаунт создан. Добро пожаловать!" : "Вы вошли в систему.",
        "success",
      );
      navigate("/Home", { replace: true });
    } catch (error) {
      addNotification(error.message || "Не удалось выполнить запрос.", "error");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form className="LoginPanel" onSubmit={handleSubmit} noValidate>
      <h1 className="labelReg">{isRegistration ? "Регистрация" : "Вход"}</h1>

      {isRegistration && (
        <input
          className="inputRegister effect effectFocus"
          type="text"
          name="name"
          placeholder="Имя"
          autoComplete="name"
          maxLength={50}
          disabled={isPending}
        />
      )}

      <input
        className="inputRegister effect effectFocus"
        type="text"
        name="login"
        placeholder="Логин"
        autoComplete="username"
        minLength={6}
        maxLength={15}
        disabled={isPending}
      />

      <input
        className="inputRegister effect effectFocus"
        type="password"
        name="password"
        placeholder="Пароль"
        autoComplete={isRegistration ? "new-password" : "current-password"}
        maxLength={15}
        disabled={isPending}
      />

      {isRegistration && (
        <input
          className="inputRegister effect effectFocus"
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          disabled={isPending}
        />
      )}

      <div>
        <div className="wrapperBtn-1d12">
          <div className="SelectRegAndIn">
            <button
              type="button"
              className={`${isRegistration ? "SelectReg btn-1f2 activeBttn" : "SelectReg btn-1f2"} `}
              onClick={() => setIsRegistration(true)}
              disabled={isPending}
            >
              Регистрация
            </button>
            <button
              type="button"
              className={`${isRegistration ? "SelectIn btn-1f2 " : "SelectIn btn-1f2 activeBttn"} `}
              onClick={() => setIsRegistration(false)}
              disabled={isPending}
            >
              Вход
            </button>
          </div>
          <button className="buttonIn effect" type="submit" disabled={isPending}>
            {isPending ? "..." : isRegistration ? "создать" : "войти"}
          </button>
        </div>
      </div>
    </form>
  );
}

