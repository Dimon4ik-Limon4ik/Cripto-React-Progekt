import { useContext, useState } from "react";
import { NotificationsContext } from "../../Context/NotificationsContext.jsx";
import { changePassword } from "../../Services/profileApi.js";
import PasswordField from "./PasswordField.jsx";
import ProfileModal from "./ProfileModal.jsx";

const INITIAL_VALUES = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

export default function ChangePasswordModal({ token, onClose }) {
  const { addNotification } = useContext(NotificationsContext);
  const [values, setValues] = useState(INITIAL_VALUES);
  const [isPending, setIsPending] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isPending) return;

    const { currentPassword, newPassword, confirmPassword } = values;

    if (!currentPassword || !newPassword || !confirmPassword) {
      addNotification("Заполните все поля", "error");
      return;
    }

    if (newPassword.length < 6 || newPassword.length > 15) {
      addNotification("Новый пароль должен содержать от 6 до 15 символов", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      addNotification("Новые пароли не совпадают", "error");
      return;
    }

    setIsPending(true);

    try {
      await changePassword(token, values);
      setIsPending(false);
      addNotification("Пароль успешно изменён.", "success");
      onClose();
    } catch (error) {
      setIsPending(false);
      addNotification(error.message || "Не удалось изменить пароль.", "error");
    }
  };

  return (
    <ProfileModal
      title="Смена пароля"
      description="Введите текущий пароль и придумайте новый — от 6 до 15 символов."
      onClose={onClose}
      isBusy={isPending}
    >
      <form className="profileForm" onSubmit={handleSubmit} noValidate>
        <PasswordField
          label="Текущий пароль"
          name="currentPassword"
          value={values.currentPassword}
          onChange={handleChange}
          autoComplete="current-password"
          placeholder="Введите текущий пароль"
          disabled={isPending}
          autoFocus
        />

        <PasswordField
          label="Новый пароль"
          name="newPassword"
          value={values.newPassword}
          onChange={handleChange}
          autoComplete="new-password"
          placeholder="От 6 до 15 символов"
          disabled={isPending}
        />

        <PasswordField
          label="Повторите новый пароль"
          name="confirmPassword"
          value={values.confirmPassword}
          onChange={handleChange}
          autoComplete="new-password"
          placeholder="Повторите новый пароль"
          disabled={isPending}
        />

        <div className="profileModalActions">
          <button
            type="button"
            className="profileSecondaryBtn"
            onClick={onClose}
            disabled={isPending}
          >
            Отмена
          </button>

          <button
            type="submit"
            className="profilePrimaryBtn"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span className="profileSpinner" aria-hidden="true" />
                Сохраняем…
              </>
            ) : (
              "Сохранить"
            )}
          </button>
        </div>
      </form>
    </ProfileModal>
  );
}
