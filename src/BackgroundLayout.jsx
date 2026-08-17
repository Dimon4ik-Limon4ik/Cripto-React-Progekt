// BackgroundLayout.jsx
import { useEffect, useState } from "react";
import Head from "./componets/Head/Head.jsx";
import { ThemeContext } from "./Context/SunMoonContext.js";
import "./BackgroundLayout.css";
import HomePage from "./componets/HomePage/HomePage.jsx";
import { getCryptoMarkets } from "./Services/Services.js";
import { CriptoContext } from "./Context/CriptoContext.js";
import { Routes, Route } from "react-router-dom";

export default function BackgroundLayout() {
  const [arrayOfCryptocurrencies, setArrayOfCryptocurrencies] = useState([]);
  const [theme, setTheme] = useState(true);

  useEffect(() => {
    const id = setInterval(async () => {
      const crypto = await getCryptoMarkets();
      setArrayOfCryptocurrencies(crypto);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const toggleTheme = () => {
    setTheme(!theme);
  };

  return (
    <CriptoContext.Provider value={arrayOfCryptocurrencies}>
      <ThemeContext.Provider value={{ theme, toggleTheme }}>
        <div
          className={
            theme === true
              ? "backgroundLayout "
              : "backgroundLayout backgroundLayoutDark"
          }
        >
          <Head />
          <Routes>
            <Route path="/Home" element={<HomePage />} />
            <Route path="/portfolio" element={<h1>Здесь типо портфель</h1>} />
            <Route path="/profile" element={<h1>Здесь профиль</h1>} />
          </Routes>
        </div>
      </ThemeContext.Provider>
    </CriptoContext.Provider>
  );
}
