import "./SunMoon.css";
import Dark from "./PictureSunMoon/Dark.svg";
import Sun from "./PictureSunMoon/Sunn.svg";

import { useContext } from "react";
import { ThemeContext } from "../../../Context/SunMoonContext.js";

export default function SunMoon() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  return (
    <button
      className={`btnSunMoon ${theme ? "" : "dark"}`}
      onClick={() => toggleTheme()}
    >
      <img className="imgSunMoon" src={Sun} alt="" />

      <img className="imgSunMoon" src={Dark} alt="" />
      <div
        className={`selectSunMoon ${theme ? "state-sun" : "state-dark"}`}
      ></div>
    </button>
  );
}
