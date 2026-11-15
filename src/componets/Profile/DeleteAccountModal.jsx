import { useContext, useState } from "react";
import { NotificationsContext } from "../../Context/NotificationsContext.jsx";
import { deleteAccount } from "../../Services/profileApi.js";
import PasswordField from "./PasswordField.jsx";
import ProfileModal from "./ProfileModal.jsx";

export default function DeleteAccountModal({ token, onClose, onDeleted }) {
  const { addNotification } = useContext(NotificationsContext);
  const [password, setPassword] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isPending) return;

    if (!password) {
      addNotification("Введите текущий пароль", "error");
      return;
    }

    if (!isConfirmed) {
      addNotification("Подтвердите удаление аккаунта", "error");
      return;
    }

    setIsPending(true);

    try {
      await deleteAccount(token, password);
      onDeleted();
    } catch (error) {
      setIsPending(false);
      addNotification(error.message || "Не удалось удалить аккаунт.", "error");
    }
  };

  return (
    <ProfileModal
      title="Удаление аккаунта"
      description="Аккаунт и избранные монеты будут удалены безвозвратно. Отменить это действие нельзя."
      tone="danger"
      onClose={onClose}
      isBusy={isPending}
    >
      <form className="profileForm" onSubmit={handleSubmit} noValidate>
        <PasswordField
          label="Текущий пароль"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          placeholder="Введите текущий пароль"
          disabled={isPending}
          autoFocus
        />

        <label className="profileCheckboxRow">
          <input
            className="profileCheckbox"
            type="checkbox"
            checked={isConfirmed}
            onChange={(event) => setIsConfirmed(event.target.checked)}
            disabled={isPending}
          />
          <span>
            Я понимаю, что аккаунт и сохранённые избранные монеты будут удалены
            без возможности восстановления.
          </span>
        </label>

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
            className="profileDangerSubmitBtn"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <span className="profileSpinner" aria-hidden="true" />
                Удаляем…
              </>
            ) : (
              "Удалить аккаунт"
            )}
          </button>
        </div>
      </form>
    </ProfileModal>
  );
}
