// import { useState } from "react"
import "./CriptoCard.css";
import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeContext } from "./../../../Context/SunMoonContext.js";
import Star from "./Star.jsx";

export default function CriptoCard({
  CryptaId,
  CryptaImg,
  CryptaName,
  CryptaPrace,
  CryptaHeightСhange,
}) {
  const { theme } = useContext(ThemeContext);
  const navigate = useNavigate();

  const openCoinPage = () => {
    if (!CryptaId) return;
    navigate(`/coin/${CryptaId}`);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openCoinPage();
  };


  


  return (
    <div
      className={theme ? "Card" : "Card Card-dark"}
      role="button"
      tabIndex={0}
      aria-label={`Открыть страницу ${CryptaName}`}
      onClick={openCoinPage}
      onKeyDown={handleKeyDown}
    >
      <img src={CryptaImg} className="ImgCriptoCard" alt="..." />
      <h2   style={CryptaName.length > 20 ? { fontSize: "14px" } : CryptaName.length > 30 ? { fontSize: "10px" } : {}} className="TextCriptoCard">{CryptaName}</h2>
      <p className="CardLabel">Цена</p>
      <h1 className="CardPrice">{CryptaPrace}$</h1>
      <p className="CardLabel">За 24 часа</p>
      <h1 className="CardChange">
        <span
          className={
            CryptaHeightСhange < 0 ? "CryptoСurrencyСrashes" : "CryptoGrowth"
          }
        >
          {CryptaHeightСhange}%
        </span>
      </h1>
      <Star CryptaId={CryptaId} />
    </div>
  );
}
