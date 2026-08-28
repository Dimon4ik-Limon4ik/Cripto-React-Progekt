// BackgroundLayout.jsx
import { useEffect, useState } from "react";
import Head from "./componets/Head/Head.jsx";
import HomePage from "./componets/HomePage/HomePage.jsx";
import Authorization from "./componets/Authorization/Authorization.jsx"
import { ThemeContext } from "./Context/SunMoonContext.js";
import "./BackgroundLayout.css";
import { getCryptoMarkets } from "./Services/Services.js";
import { CriptoContext } from "./Context/CriptoContext.js";
import { Routes, Route,Navigate } from "react-router-dom";

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
       
          
          <Routes>
            <Route path="/" element={<Navigate to="/Home" replace />} />
            <Route path="/Home" element={<><Head /> <HomePage /></> } />
            <Route path="/portfolio" element={<><Head /> <h1>Здесь типо портфель</h1></>} />
            <Route
              path="/profile"
              element={<><Head />
               <h1>Профиль</h1></>
              }
            />
            <Route path="/authorization" element={<Authorization/>}/>
          </Routes>
        </div>
      </ThemeContext.Provider>
    </CriptoContext.Provider>
  );
}
