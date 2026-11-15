import "./notifications.css";

const NOTIFICATION_TITLES = {
  success: "Успешно!",
  error: "Ошибка",
  info: "Уведомление",
};

function NotificationIcon({ type }) {
  if (type === "success") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5.5 12.5 4.5 4.5 8.5-9" />
      </svg>
    );
  }

  if (type === "error") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 7l10 10M17 7 7 17" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

export default function Notifications({ notification, onRemove }) {
  const type =
    notification.type === "success" || notification.type === "error"
      ? notification.type
      : "info";

  return (
    <div
      className={`Notifications Notifications-${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <span className="NotificationsIcon" aria-hidden="true">
        <NotificationIcon type={type} />
      </span>

      <div className="NotificationsContent">
        <p className="NotificationsTitle">{NOTIFICATION_TITLES[type]}</p>
        <p className="NotificationsText">{notification.message}</p>
      </div>

      <button
        type="button"
        className="DeleteNotifications"
        onClick={() => onRemove(notification.id)}
        aria-label="Закрыть уведомление"
        title="Закрыть"
      >
        <span aria-hidden="true">&times;</span>
      </button>
    </div>
  );
}
