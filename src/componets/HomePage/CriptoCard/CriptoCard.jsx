// import { useState } from "react"
import "./CriptoCard.css";
import { useContext } from "react";
import { ThemeContext } from "./../../../Context/SunMoonContext.js";
import Star from "./Star.jsx";

export default function CriptoCard({
  CryptaImg,
  CryptaName,
  CryptaPrace,
  CryptaHeightСhange,
}) {
  const { theme } = useContext(ThemeContext);
  


  return (
    <div className={theme ? "Card" : "Card Card-dark "}>
      <img src={CryptaImg} className="ImgCriptoCard" alt="..." />
      <h2   style={CryptaName.length > 20 ? { fontSize: "14px" } : CryptaName.length > 30 ? { fontSize: "10px" } : {}} className="TextCriptoCard">{CryptaName}</h2>
      <p className="CardLabel">Цена</p>
      <p className="CardPrice">{CryptaPrace}$</p>
      <p className="CardLabel">За 24 часа</p>
      <p className="CardChange">
        <span
          className={
            CryptaHeightСhange < 0 ? "CryptoСurrencyСrashes" : "CryptoGrowth"
          }
        >
          {CryptaHeightСhange}%
        </span>
      </p>
      <Star/>
    </div>
  );
}
