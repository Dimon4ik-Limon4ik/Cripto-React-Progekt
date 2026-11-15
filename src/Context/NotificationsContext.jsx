import { createContext, useState, useCallback, useEffect, useRef } from "react";

// eslint-disable-next-line react-refresh/only-export-components
export const NotificationsContext = createContext();

export function NotificationsProvider({ children }) {
  const [notifications, setNotifications] = useState([]);
  const timersRef = useRef({});

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    delete timersRef.current[id];
  }, []);

  const addNotification = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    const newNotification = { id, message, type };

    setNotifications((prev) => [...prev, newNotification]);

    timersRef.current[id] = setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }, [removeNotification]);

  // Очистка таймеров при размонтировании
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  return (
    <NotificationsContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
    </NotificationsContext.Provider>
  );
}