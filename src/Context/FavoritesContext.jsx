import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext.jsx";
import { NotificationsContext } from "./NotificationsContext.jsx";
import {
  addFavorite,
  clearFavorites as clearFavoritesRequest,
  getFavorites,
  removeFavorite,
} from "../Services/favoritesApi.js";

// Общий ключ старых версий: избранное больше не хранится в браузере.
const LEGACY_FAVORITES_STORAGE_KEY = "cripto-favorites";

// eslint-disable-next-line react-refresh/only-export-components
export const FavoritesContext = createContext(null);

export function FavoritesProvider({ children }) {
  const { token, isCheckingToken } = useAuth();
  const { addNotification } = useContext(NotificationsContext) ?? {};
  const [favoriteIds, setFavoriteIds] = useState([]);
  const favoriteIdsRef = useRef([]);
  const syncVersionRef = useRef(0);

  const applyFavorites = useCallback((ids) => {
    favoriteIdsRef.current = ids;
    setFavoriteIds(ids);
  }, []);

  const notify = useCallback(
    (message, type = "error") => {
      if (typeof addNotification === "function") {
        addNotification(message, type);
      }
    },
    [addNotification],
  );

  // Старый локальный список был общим для всех аккаунтов — убираем его.
  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_FAVORITES_STORAGE_KEY);
    } catch {
      // Приватный режим браузера может запрещать localStorage.
    }
  }, []);

  // При входе загружаем избранное именно текущего пользователя.
  useEffect(() => {
    // Ждём проверки сохранённого токена, чтобы не ловить ложный 401.
    if (isCheckingToken) return undefined;

    if (!token) {
      syncVersionRef.current += 1;
      applyFavorites([]);
      return undefined;
    }

    let cancelled = false;
    const version = ++syncVersionRef.current;

    getFavorites(token)
      .then((ids) => {
        if (!cancelled && version === syncVersionRef.current) {
          applyFavorites(ids);
        }
      })
      .catch((error) => {
        if (cancelled || version !== syncVersionRef.current) return;
        notify(error.message || "Не удалось загрузить избранное.");
      });

    return () => {
      cancelled = true;
    };
  }, [token, isCheckingToken, applyFavorites, notify]);

  const toggleFavorite = useCallback(
    (coinId) => {
      if (!coinId) return;

      if (!token) {
        notify("Войдите, чтобы сохранять избранные монеты.", "info");
        return;
      }

      const previous = favoriteIdsRef.current;
      const wasFavorite = previous.includes(coinId);
      const next = wasFavorite
        ? previous.filter((id) => id !== coinId)
        : [...previous, coinId];

      const version = ++syncVersionRef.current;
      applyFavorites(next);

      // Сервер возвращает актуальный список целиком: так состояние не
      // разойдётся с БД даже при быстрых повторных нажатиях.
      const requestPromise = wasFavorite
        ? removeFavorite(token, coinId)
        : addFavorite(token, coinId);

      requestPromise
        .then((ids) => {
          if (version === syncVersionRef.current) {
            applyFavorites(ids);
          }
        })
        .catch((error) => {
          if (version !== syncVersionRef.current) return;
          applyFavorites(previous);
          notify(error.message || "Не удалось обновить избранное.");
        });
    },
    [token, applyFavorites, notify],
  );

  const isFavorite = useCallback(
    (coinId) => favoriteIds.includes(coinId),
    [favoriteIds],
  );

  const clearFavorites = useCallback(() => {
    const currentToken = token;
    syncVersionRef.current += 1;
    applyFavorites([]);

    if (!currentToken) return;

    // При удалении аккаунта строки уже удалены каскадно, поэтому ошибку
    // (например, 401) здесь просто игнорируем.
    clearFavoritesRequest(currentToken).catch(() => {});
  }, [token, applyFavorites]);

  const value = useMemo(
    () => ({ favoriteIds, isFavorite, toggleFavorite, clearFavorites }),
    [favoriteIds, isFavorite, toggleFavorite, clearFavorites],
  );

  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useFavorites() {
  const context = useContext(FavoritesContext);

  if (!context) {
    throw new Error(
      "useFavorites должен использоваться внутри FavoritesProvider",
    );
  }

  return context;
}
