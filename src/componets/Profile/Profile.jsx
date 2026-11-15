import { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Context/AuthContext.jsx";
import { useFavorites } from "../../Context/FavoritesContext.jsx";
import { NotificationsContext } from "../../Context/NotificationsContext.jsx";
import { ThemeContext } from "../../Context/SunMoonContext.js";
import { getProfile, ProfileApiError } from "../../Services/profileApi.js";
import { removeToken } from "../../Services/tokenStorage.js";
import ChangePasswordModal from "./ChangePasswordModal.jsx";
import DeleteAccountModal from "./DeleteAccountModal.jsx";
import "./Profile.css";

function formatRegistrationDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getDisplayValue(value) {
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}

export default function Profile() {
  const { token, signOut } = useAuth();
  const { clearFavorites } = useFavorites();
  const { theme } = useContext(ThemeContext);
  const { addNotification } = useContext(NotificationsContext);
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeModal, setActiveModal] = useState(null);

  const loadProfile = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setLoadError("");

    try {
      const data = await getProfile(token);

      if (!data) {
        throw new Error("Сервер вернул пустые данные профиля.");
      }

      setProfile(data);
    } catch (error) {
      // Истёкший или отозванный токен — завершаем сессию.
      if (error instanceof ProfileApiError && error.status === 401) {
        signOut();
        addNotification("Сессия истекла. Войдите снова.", "error");
        navigate("/authorization", { replace: true });
        return;
      }

      setProfile(null);
      setLoadError(error.message || "Не удалось загрузить данные профиля.");
    } finally {
      setIsLoading(false);
    }
  }, [token, signOut, addNotification, navigate]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const openPasswordModal = useCallback(() => setActiveModal("password"), []);
  const openDeleteModal = useCallback(() => setActiveModal("delete"), []);
  const closeModal = useCallback(() => setActiveModal(null), []);

  const handleAccountDeleted = useCallback(() => {
    // Полный выход: токен, AuthContext и персональное избранное.
    removeToken();
    signOut();
    clearFavorites();
    navigate("/authorization", { replace: true });
    addNotification("Аккаунт удалён. Вы вышли из системы.", "success");
  }, [signOut, clearFavorites, navigate, addNotification]);

  const accountFields = profile
    ? [
        { label: "Имя", value: getDisplayValue(profile.name) },
        { label: "Логин", value: getDisplayValue(profile.login) },
        { label: "Email", value: getDisplayValue(profile.email) },
        {
          label: "Дата регистрации",
          value: formatRegistrationDate(profile.registeredAt),
        },
      ]
    : [];

  return (
    <section
      className={`profilePage ${theme ? "" : "profilePage-dark"}`}
      aria-labelledby="profile-page-title"
    >
      <header className="profileHeader">
        <p className="profileEyebrow">Аккаунт</p>
        <h1 className="profileTitle" id="profile-page-title">
          Профиль
        </h1>
        <p className="profileSubtitle">
          Данные вашей учётной записи и управление безопасностью.
        </p>
      </header>

      {isLoading ? (
        <div className="profileStateCard" aria-busy="true">
          <span
            className="profileSpinner profileSpinner-large"
            aria-hidden="true"
          />
          <p className="profileStateText">Загружаем данные аккаунта…</p>
        </div>
      ) : loadError ? (
        <div className="profileStateCard" role="alert">
          <h2 className="profileStateTitle">Не удалось загрузить профиль</h2>
          <p className="profileStateText">{loadError}</p>
          <button
            type="button"
            className="profilePrimaryBtn"
            onClick={loadProfile}
          >
            Повторить
          </button>
        </div>
      ) : profile ? (
        <>
          <section
            className="profileSection"
            aria-labelledby="profile-account-title"
          >
            <header className="profileSectionHeader">
              <div>
                <h2 className="profileSectionTitle" id="profile-account-title">
                  Данные аккаунта
                </h2>
                <p className="profileSectionHint">
                  Эти данные доступны только для просмотра.
                </p>
              </div>
            </header>

            <div className="profileInfoGrid">
              {accountFields.map((field) => (
                <article className="profileInfoCard" key={field.label}>
                  <span className="profileInfoLabel">{field.label}</span>
                  <span className="profileInfoValue">{field.value}</span>
                </article>
              ))}
            </div>
          </section>

          <section
            className="profileSection"
            aria-labelledby="profile-security-title"
          >
            <header className="profileSectionHeader">
              <div>
                <h2 className="profileSectionTitle" id="profile-security-title">
                  Безопасность
                </h2>
                <p className="profileSectionHint">
                  Регулярно меняйте пароль и не используйте его на других
                  сайтах.
                </p>
              </div>
            </header>

            <div className="profileSecurityRow">
              <div className="profileSecurityInfo">
                <span className="profileInfoLabel">Пароль</span>
                <span className="profileSecurityValue">••••••••</span>
              </div>

              <button
                type="button"
                className="profilePrimaryBtn"
                onClick={openPasswordModal}
              >
                Сменить пароль
              </button>
            </div>
          </section>

          <section
            className="profileDangerZone"
            aria-labelledby="profile-danger-title"
          >
            <div className="profileDangerInfo">
              <h2 className="profileDangerTitle" id="profile-danger-title">
                Удаление аккаунта
              </h2>
              <p className="profileDangerText">
                Аккаунт и сохранённые избранные монеты будут удалены
                безвозвратно.
              </p>
            </div>

            <button
              type="button"
              className="profileDangerBtn"
              onClick={openDeleteModal}
            >
              Удалить аккаунт
            </button>
          </section>
        </>
      ) : null}

      {token && activeModal === "password" ? (
        <ChangePasswordModal token={token} onClose={closeModal} />
      ) : null}

      {token && activeModal === "delete" ? (
        <DeleteAccountModal
          token={token}
          onClose={closeModal}
          onDeleted={handleAccountDeleted}
        />
      ) : null}
    </section>
  );
}
