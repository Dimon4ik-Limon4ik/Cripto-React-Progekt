// BackgroundLayout.jsx
import { useEffect, useState } from "react";
import Head from "./componets/Head/Head.jsx";
import HomePage from "./componets/HomePage/HomePage.jsx";
import CoinPage from "./componets/CoinPage/CoinPage.jsx";
import Portfolio from "./componets/Portfolio/Portfolio.jsx";
import Profile from "./componets/Profile/Profile.jsx";
import Authorization from "./componets/Authorization/Authorization.jsx";
import { ThemeContext } from "./Context/SunMoonContext.js";
import "./BackgroundLayout.css";
import { getCryptoMarkets } from "./Services/Services.js";
import { CriptoContext } from "./Context/CriptoContext.js";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./Context/AuthContext.jsx";
import NotificationsWrapper from "./componets/notifications/notificationsWrapper.jsx";

// Пока идёт проверка сохранённого токена, приватные страницы не показываем.
function ProtectedRoute({ children }) {
  const { isAuthenticated, isCheckingToken } = useAuth();

  if (isCheckingToken) return null;

  // Нет токена в localStorage — любая страница ведёт на регистрацию, а не на главную.
  return isAuthenticated ? children : <Navigate to="/authorization" replace />;
}

// Форма входа доступна только без сессии: авторизованного уводим на главную.
function GuestOnlyRoute() {
  const { isAuthenticated, isCheckingToken } = useAuth();

  if (isCheckingToken) return null;

  return isAuthenticated ? <Navigate to="/Home" replace /> : <Authorization />;
}

// Точка входа (`/`) и неизвестные адреса: без токена — регистрация, с токеном — главная.
function EntryRedirect() {
  const { isAuthenticated, isCheckingToken } = useAuth();

  if (isCheckingToken) return null;

  return <Navigate to={isAuthenticated ? "/Home" : "/authorization"} replace />;
}

export default function BackgroundLayout() {
  const [arrayOfCryptocurrencies, setArrayOfCryptocurrencies] = useState([]);
  // loading | ready | error — нужно, чтобы отличить «ещё грузится» от сбоя.
  const [cryptoStatus, setCryptoStatus] = useState("loading");
  const [cryptoReloadKey, setCryptoReloadKey] = useState(0);
  const [theme, setTheme] = useState(true);
  const location = useLocation();
  const isCoinPage = location.pathname.startsWith("/coin/");
  const isFixedPage =
    isCoinPage || location.pathname.startsWith("/portfolio");

  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    const loadCrypto = async () => {
      try {
        const crypto = await getCryptoMarkets({ rethrow: true });

        // Пустой ответ не затирает уже загруженные данные.
        if (!cancelled && Array.isArray(crypto) && crypto.length > 0) {
          failures = 0;
          setArrayOfCryptocurrencies(crypto);
          setCryptoStatus("ready");
        }
      } catch {
        failures += 1;

        // Одиночный сбой считаем временным (следующий опрос через 3 с),
        // а устойчивую ошибку показываем с кнопкой повтора. Уже
        // загруженные котировки при этом не стираем.
        if (!cancelled && failures >= 2) {
          setCryptoStatus((prev) => (prev === "ready" ? "ready" : "error"));
        }
      }
    };

    loadCrypto();
    const id = setInterval(loadCrypto, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [cryptoReloadKey]);

  // Повторная загрузка по кнопке: перезапускает и первый запрос, и опрос.
  const reloadCrypto = () => {
    setCryptoStatus("loading");
    setCryptoReloadKey((key) => key + 1);
  };

  const toggleTheme = () => {
    setTheme(!theme);
  };

  return (
    <CriptoContext.Provider value={arrayOfCryptocurrencies}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <div
          className={`backgroundLayout ${
            theme === true ? "" : "backgroundLayoutDark"
          } ${isFixedPage ? "backgroundLayoutNoScroll" : ""}`}
        >
          <NotificationsWrapper />

          <Routes>
            <Route path="/" element={<EntryRedirect />} />
            <Route
              path="/Home"
              element={
                <ProtectedRoute>
                  <Head />
                  <HomePage status={cryptoStatus} onRetry={reloadCrypto} />
                </ProtectedRoute>
              }
            />
            <Route
              path="/coin/:coinId"
              element={
                <ProtectedRoute>
                  <Head />
                  <CoinPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <Head />
                  <Portfolio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Head />
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="/authorization" element={<GuestOnlyRoute />} />
            <Route path="*" element={<EntryRedirect />} />
          </Routes>
        </div>
      </ThemeContext.Provider>
    </CriptoContext.Provider>
  );
}
