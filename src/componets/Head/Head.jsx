import "./Head.css";
import Home from "./Picture/Home.svg";
import Profile from "./Picture/Profile.svg";
import Start from "./Picture/Star.svg";
import Out from "./Picture/Out.svg";
import Back from "./Picture/Back.svg";
import SunMoon from "./SunMoon/SunMoon.jsx";
import { useContext, useEffect, useState } from "react";
import { ThemeContext } from "../../Context/SunMoonContext.js";
import { useNavigate, useLocation } from "react-router-dom";

export default function Head() {
  const [selectNumberPage, setSelectNumberPage] = useState(0);
  const { theme } = useContext(ThemeContext);

  const navigate = useNavigate();
  const location = useLocation();
  useEffect(()=>{navigate("/Home")},[])
  useEffect(() => {
    const path = location.pathname;
    if (path === "/Home") setSelectNumberPage(0);
    else if (path === "/portfolio") setSelectNumberPage(1);
    else if (path === "/profile") setSelectNumberPage(2);
    else if (path === "/authorization") setSelectNumberPage(3);
    else {
      setSelectNumberPage(0);
    }
  }, [location]);

  const handleNavigate = (index, path) => {
    setSelectNumberPage(index);
    navigate(path);
  };

  return (
    <nav className={`HeadWrapper ${theme ? "" : "HeadWrapperDark"}`}>
      <ul className={`functionalPanel ${theme ? "" : "func-Panel-Dark"}`}>
        <li>
          <button className="btnNav" onClick={() => handleNavigate(0, "/Home")}>
            <img className="imageNav" src={Home} alt="Home" />
          </button>
        </li>
        <li>
          <button
            className="btnNav"
            onClick={() => handleNavigate(1, "/portfolio")}
          >
            <img className="imageNav" src={Start} alt="Start" />
          </button>
        </li>
        <li>
          <button
            className="btnNav"
            onClick={() => handleNavigate(2, "/profile")}
          >
            <img className="imageNav" src={Profile} alt="Profile" />
          </button>
        </li>
        <div
          className={`selectNav ${
            selectNumberPage === 0
              ? "selectNav_0"
              : selectNumberPage === 1
                ? "selectNav_1"
                : "selectNav_2"
          }`}
        ></div>
      </ul>
      <SunMoon />
      <button className={`btnNav outBtn ${theme ? "" : "outBtn-Dark"}`} onClick={() => handleNavigate(3, "/authorization")} >
        <img className="imageNav" src={Out} alt="Out Profile" />
      </button>
    </nav>
  );
}
