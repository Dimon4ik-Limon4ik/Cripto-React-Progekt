import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import tokenCheck from "../Services/tokenCheck.js";
import { getToken, removeToken, saveToken } from "../Services/tokenStorage.js";

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getToken());
  const [isCheckingToken, setIsCheckingToken] = useState(() => Boolean(getToken()));

  // При старте проверяем сохранённый токен, чтобы восстановить сессию.
  useEffect(() => {
    const storedToken = getToken();

    if (!storedToken) {
      setIsCheckingToken(false);
      return undefined;
    }

    let cancelled = false;

    tokenCheck(storedToken)
      .then((isValid) => {
        if (cancelled || isValid) return;
        removeToken();
        setToken(null);
      })
      .catch(() => {
        // Сервер недоступен — оставляем токен, чтобы не разлогинивать пользователя.
      })
      .finally(() => {
        if (!cancelled) setIsCheckingToken(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback((newToken) => {
    saveToken(newToken);
    setToken(newToken);
  }, []);

  const signOut = useCallback(() => {
    removeToken();
    setToken(null);
  }, []);

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: Boolean(token),
      isCheckingToken,
      signIn,
      signOut,
    }),
    [token, isCheckingToken, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth должен использоваться внутри AuthProvider");
  }

  return context;
}
