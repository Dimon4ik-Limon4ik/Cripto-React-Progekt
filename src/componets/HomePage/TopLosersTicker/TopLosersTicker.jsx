import { useContext, useMemo } from "react";
import { ThemeContext } from "./../../../Context/SunMoonContext.js";
import { CriptoContext } from "./../../../Context/CriptoContext.js";
import "./../CriptoCard/CriptoCard.css";
import "./TopLosersTicker.css";

export default function TopLosersTicker() {
  const { theme } = useContext(ThemeContext);
  const crypta = useContext(CriptoContext);

  // Берём данные из общего контекста (их уже загружает BackgroundLayout),
  // чтобы не дублировать запросы к CoinGecko и не зависеть от токена.
  const coins = useMemo(
    () =>
      [...(crypta || [])]
        .filter((coin) => coin?.price_change_percentage_24h != null)
        .sort(
          (a, b) =>
            a.price_change_percentage_24h - b.price_change_percentage_24h,
        )
        .slice(0, 10),
    [crypta],
  );

  if (coins.length === 0) return null;

  // Дублируем массив для бесшовной прокрутки
  const doubledCoins = [...coins, ...coins];

  return (
    <div className="losersTickerContainer">
      <div className="losersTickerHeader">
        <span className="losersTickerFire">📉</span>
        <span className={`losersTickerTitle ${theme ? "" : "losersTickerTitle-dark"}`}>
          Топ 10 падение за 24 часа
        </span>
      </div>
      <div className="losersTickerTrackWrapper">
        <div className="losersTickerTrack">
          {doubledCoins.map((coin, index) => (
            <div
              key={`${coin.id}-${index}`}
              className={`losersTickerCard Card ${theme ? "" : "Card-dark"}`}
            >
              <img
                src={coin.image}
                alt={coin.symbol}
                className="losersTickerCardImg"
              />
              <div className="losersTickerCardInfo">
                <span
                  className={`losersTickerCardName ${theme ? "" : "losersTickerCardName-dark"}`}
                  style={
                    coin.name.length > 14
                      ? { fontSize: "14px" }
                      : coin.name.length > 10
                      ? { fontSize: "16px" }
                      : {}
                  }
                >
                  {coin.name}
                </span>
                <span
                  className={`losersTickerCardChange CryptoСurrencyСrashes ${theme ? "" : "losersTickerCardChange-dark"}`}
                >
                  {coin.price_change_percentage_24h > 0 ? "+" : ""}
                  {coin.price_change_percentage_24h?.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}