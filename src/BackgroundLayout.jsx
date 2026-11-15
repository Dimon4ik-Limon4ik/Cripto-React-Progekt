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

  return isAuthenticated ? children : <Navigate to="/authorization" replace />;
}

export default function BackgroundLayout() {
  const [arrayOfCryptocurrencies, setArrayOfCryptocurrencies] = useState([]);
  const [theme, setTheme] = useState(true);
  const { isAuthenticated, isCheckingToken } = useAuth();
  const location = useLocation();
  const isCoinPage = location.pathname.startsWith("/coin/");
  const isFixedPage =
    isCoinPage || location.pathname.startsWith("/portfolio");

  useEffect(() => {
    let cancelled = false;

    const loadCrypto = async () => {
      const crypto = await getCryptoMarkets();

      // Пустой ответ обычно означает сетевую ошибку или лимит API —
      // не стираем уже загруженные данные из-за одного неудачного опроса.
      if (!cancelled && Array.isArray(crypto) && crypto.length > 0) {
        setArrayOfCryptocurrencies(crypto);
      }
    };

    loadCrypto();
    const id = setInterval(loadCrypto, 3000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

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
            <Route path="/" element={<Navigate to="/Home" replace />} />
            <Route path="/Home" element={<><Head /> <HomePage /></> } />
            <Route
              path="/coin/:coinId"
              element={
                <>
                  <Head />
                  <CoinPage />
                </>
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
            <Route
              path="/authorization"
              element={
                isCheckingToken ? null : isAuthenticated ? (
                  <Navigate to="/Home" replace />
                ) : (
                  <Authorization />
                )
              }
            />
            <Route path="*" element={<Navigate to="/Home" replace />} />
          </Routes>
        </div>
      </ThemeContext.Provider>
    </CriptoContext.Provider>
  );
}
