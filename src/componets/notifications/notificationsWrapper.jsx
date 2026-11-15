import "./notifications.css";
import { useContext } from "react";
import Notifications from "./notifications.jsx";
import { NotificationsContext } from "./../../Context/NotificationsContext.jsx";

export default function NotificationsWrapper() {
  const { notifications, removeNotification } = useContext(NotificationsContext);

  if (notifications.length === 0) return null;

  return (
    <div className="notificationsWrapper">
      {notifications.map((notification) => (
        <Notifications
          key={notification.id}
          notification={notification}
          onRemove={removeNotification}
        />
      ))}
    </div>
  );
}
